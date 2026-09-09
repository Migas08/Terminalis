/* Verifica o motor do Docker: imagens, containers, volumes, redes,
   Dockerfile, Compose e Traefik. Cada afirmação aqui é um comportamento
   que alguma aula ensina — se quebrar, a aula passa a mentir. */
const { loadEngine, makeSession } = require('./harness');
const LX = loadEngine();

let ok = 0, mau = 0;
const limpa = (s) => String(s).replace(/\x1b?\[[0-9;]*m/g, '');
const T = (nome, cond, extra) => {
  if (cond) { ok++; }
  else { mau++; console.log('  ✗ ' + nome + (extra !== undefined ? '\n      → ' + String(extra).slice(0, 400).replace(/\n/g, '\n      ') : '')); }
};
const grupo = (n) => console.log('\n' + n);

(async () => {
  const s = makeSession(LX);
  const R = async (cmd) => { const r = await s.run(cmd); return { status: r.status, out: limpa(r.out) }; };
  const eng = s.m.docker;

  /* ================================================================= */
  grupo('1. o daemon e o cliente');
  {
    let r = await R('docker --version');
    T('docker --version responde', /^Docker version \d+/.test(r.out), r.out);
    r = await R('docker version');
    T('docker version mostra cliente e servidor', /Client:/.test(r.out) && /Server:/.test(r.out));
    r = await R('docker info');
    T('docker info conta containers e imagens', /Containers: \d+/.test(r.out) && /Images: \d+/.test(r.out));
    T('docker info identifica o storage driver', /Storage Driver:/.test(r.out));

    /* a permissão é do grupo docker; sem ele o socket recusa */
    r = await R('getent group docker');
    T('existe o grupo docker com o aluno dentro', /^docker:.*aluno/.test(r.out.trim()), r.out);
    await R("sudo sed -i 's/^docker:x:988:aluno$/docker:x:988:/' /etc/group");
    r = await R('docker ps');
    T('sem o grupo docker o socket recusa', r.status !== 0 && /permission denied/.test(r.out), r.out);
    await R("sudo sed -i 's/^docker:x:988:$/docker:x:988:aluno/' /etc/group");
    r = await R('docker ps');
    T('com o grupo docker volta a funcionar', r.status === 0, r.out);
  }

  grupo('2. imagens: pull, tags, camadas, digest');
  {
    let r = await R('docker pull alpine:3.21');
    T('pull baixa a imagem', r.status === 0 && /Pull complete/.test(r.out), r.out);
    r = await R('docker pull alpine:3.21');
    T('pull de novo diz que já está atualizada', /Image is up to date/.test(r.out), r.out);
    r = await R('docker pull naoexiste-terminalis');
    T('imagem inexistente dá erro de acesso negado', r.status !== 0 && /repository does not exist/.test(r.out), r.out);
    r = await R('docker pull alpine:versao-que-nao-existe');
    T('tag inexistente dá "manifest unknown"', /manifest unknown/.test(r.out), r.out);

    r = await R('docker images');
    T('images lista repositório, tag, id e tamanho', /REPOSITORY\s+TAG\s+IMAGE ID\s+CREATED\s+SIZE/.test(r.out));
    r = await R('docker tag alpine:3.21 minha-alpine:v1');
    T('tag cria outro nome para a mesma imagem', r.status === 0);
    r = await R('docker images -q alpine:3.21');
    const idA = r.out.trim();
    r = await R('docker images -q minha-alpine:v1');
    T('a imagem marcada é a MESMA (mesmo Image ID)', r.out.trim() === idA, r.out);
    r = await R('docker rmi minha-alpine:v1');
    T('remover uma das tags só desmarca', /^Untagged: minha-alpine:v1/m.test(r.out) && !/Deleted:/.test(r.out), r.out);
    r = await R('docker images -q alpine:3.21');
    T('a imagem continua lá depois de remover a tag extra', r.out.trim() === idA);

    r = await R('docker image inspect alpine:3.21 --format "{{.Os}}/{{.Architecture}} {{json .RootFS.Layers}}"');
    T('inspect mostra camadas', /linux\/amd64 \["sha256:/.test(r.out), r.out);
    r = await R('docker history alpine:3.21');
    T('history mostra como a imagem foi feita', /CREATED BY/.test(r.out) && /ADD file:/.test(r.out), r.out);
  }

  grupo('3. imagem não é container');
  {
    await R('docker run --name c1 alpine sh -c "echo um > /marca.txt"');
    await R('docker run --name c2 alpine sh -c "echo dois > /marca.txt"');
    let r = await R('docker start -a c1 2>/dev/null; docker exec c1 cat /marca.txt 2>/dev/null || true');
    /* containers parados guardam o próprio sistema de arquivos */
    r = await R('docker diff c1');
    T('cada container tem a sua camada gravável', /A \/marca\.txt/.test(r.out), r.out);
    r = await R('docker run --rm alpine cat /marca.txt');
    T('um container novo da mesma imagem não vê a alteração do outro',
      r.status !== 0 && /No such file/.test(r.out), r.out);
    await R('docker rm -f c1 c2');
  }

  grupo('4. ciclo de vida do container');
  {
    let r = await R('docker run -d --name ciclo nginx:alpine');
    T('run -d devolve o id e segue em frente', r.status === 0 && /^[0-9a-f]{64}$/.test(r.out.trim()), r.out);
    r = await R('docker ps --filter name=ciclo --format "{{.State}}"');
    T('o container aparece em execução', r.out.trim() === 'running', r.out);
    await R('docker stop ciclo');
    r = await R('docker ps --format "{{.Names}}"');
    T('parado, some do docker ps', !/ciclo/.test(r.out), r.out);
    r = await R('docker ps -a --format "{{.Names}} {{.State}}"');
    T('mas continua em docker ps -a', /ciclo exited/.test(r.out), r.out);
    r = await R('docker start ciclo');
    T('start levanta de novo', r.status === 0);
    r = await R('docker restart ciclo');
    T('restart funciona', r.status === 0);
    r = await R('docker pause ciclo');
    T('pause congela', r.status === 0);
    r = await R('docker ps --format "{{.Status}}" --filter name=ciclo');
    T('o status mostra (Paused)', /Paused/.test(r.out), r.out);
    r = await R('docker start ciclo');
    T('start recusa container pausado', r.status !== 0 && /unpause/.test(r.out), r.out);
    await R('docker unpause ciclo');
    r = await R('docker rm ciclo');
    T('rm recusa container em execução', r.status !== 0 && /container is running/.test(r.out), r.out);
    r = await R('docker rm -f ciclo');
    T('rm -f remove mesmo assim', r.status === 0);
    r = await R('docker rm ciclo');
    T('remover o que não existe explica direito', r.status !== 0 && /No such container/.test(r.out), r.out);
  }

  grupo('5. flags do run');
  {
    let r = await R('docker run -d -p 8080:80 --name pweb nginx:alpine');
    T('-p publica a porta', r.status === 0, r.out);
    r = await R('docker ps --filter name=pweb --format "{{.Ports}}"');
    T('a porta publicada aparece no ps', /0\.0\.0\.0:8080->80\/tcp/.test(r.out), r.out);
    r = await R('curl -s -o /dev/null -w "%{http_code}" localhost:8080');
    T('a porta publicada responde no host', r.out.trim() === '200', r.out);
    r = await R('ss -tln');
    T('ss vê a porta publicada no host', /:8080/.test(r.out), r.out);
    r = await R('docker run -d -p 8080:80 --name pweb2 nginx:alpine');
    T('duas publicações na mesma porta colidem', r.status !== 0 && /address already in use/.test(r.out), r.out);
    await R('docker rm -f pweb2 2>/dev/null; true');
    r = await R('docker port pweb');
    T('docker port lista o mapeamento', /80\/tcp -> 0\.0\.0\.0:8080/.test(r.out), r.out);
    await R('docker rm -f pweb');

    r = await R("docker run --rm -e MENSAGEM=ola alpine sh -c 'echo $MENSAGEM'");
    T('-e injeta variável de ambiente', r.out.trim() === 'ola', r.out);
    await R('printf "A=1\\n# comentario\\nB=2\\n" > /home/aluno/vars.env');
    r = await R("docker run --rm --env-file /home/aluno/vars.env alpine sh -c 'echo $A-$B'");
    T('--env-file lê o arquivo e ignora comentários', r.out.trim() === '1-2', r.out);
    r = await R('docker run --rm --env-file /home/aluno/naoexiste.env alpine true');
    T('--env-file inexistente falha com clareza', r.status !== 0 && /no such file/.test(r.out), r.out);

    r = await R('docker run --rm --name efemero alpine true; docker ps -a --format "{{.Names}}"');
    T('--rm apaga o container ao terminar', !/efemero/.test(r.out), r.out);
    r = await R('docker run --rm --restart always alpine true');
    T('--rm com --restart é recusado', r.status !== 0 && /Conflicting options/.test(r.out), r.out);

    r = await R('docker run --rm -w /etc alpine pwd');
    T('-w troca o diretório de trabalho', r.out.trim() === '/etc', r.out);
    r = await R('docker run --rm --entrypoint sh alpine -c "echo trocado"');
    T('--entrypoint substitui o entrypoint da imagem', r.out.trim() === 'trocado', r.out);
    r = await R('docker run --rm -h meu-host alpine hostname');
    T('--hostname muda o hostname de dentro', r.out.trim() === 'meu-host', r.out);
    r = await R('docker run --rm -u 1000 alpine id -u');
    T('-u roda como outro usuário', r.out.trim() === '1000', r.out);
    r = await R('docker run --rm alpine bash');
    T('bash não existe no Alpine, e o erro diz isso',
      r.status !== 0 && /executable file not found in \$PATH/.test(r.out), r.out);
    r = await R('docker run --rm alpine /bin/sh -c "echo o sh existe"');
    T('/bin/sh existe no Alpine', r.out.trim() === 'o sh existe', r.out);
    r = await R('docker run --rm -m 64m --cpus 0.5 --name lim alpine true; true');
    T('--memory e --cpus são aceitos', r.status === 0, r.out);
  }

  grupo('6. exec e logs');
  {
    await R('docker run -d --name alvo nginx:alpine');
    let r = await R('docker exec alvo ls /usr/share/nginx/html');
    T('exec roda um comando dentro do container', /index\.html/.test(r.out), r.out);
    r = await R('docker exec alvo sh -c "echo dentro > /tmp/x && cat /tmp/x"');
    T('exec com sh -c aceita uma linha inteira', r.out.trim() === 'dentro', r.out);
    r = await R('docker exec alvo cat /etc/hostname 2>/dev/null || docker exec alvo hostname');
    T('o hostname de dentro é o id curto do container', r.out.trim().length >= 12, r.out);
    r = await R('docker exec parado-inexistente ls');
    T('exec em container inexistente explica', r.status !== 0 && /No such container/.test(r.out), r.out);
    await R('docker stop alvo');
    r = await R('docker exec alvo ls');
    T('exec em container parado explica', r.status !== 0 && /is not running/.test(r.out), r.out);
    await R('docker start alvo');
    r = await R('docker logs alvo');
    T('logs mostram a saída do processo principal', /start worker processes/.test(r.out), r.out);
    r = await R('docker logs --tail 2 alvo');
    T('--tail limita as linhas', r.out.trim().split('\n').length === 2, r.out);
    await R('curl -s localhost >/dev/null 2>&1 || true');
    await R('docker rm -f alvo');
  }

  grupo('7. volumes e persistência');
  {
    let r = await R('docker volume create meus-dados');
    T('volume create devolve o nome', r.out.trim() === 'meus-dados');
    r = await R('docker volume inspect meus-dados --format "{{.Mountpoint}}"');
    T('o volume tem um caminho real no host', r.out.trim() === '/var/lib/docker/volumes/meus-dados/_data', r.out);
    await R('docker run --rm -v meus-dados:/dados alpine sh -c "echo persistente > /dados/arquivo.txt"');
    r = await R('sudo cat /var/lib/docker/volumes/meus-dados/_data/arquivo.txt');
    T('o que o container escreveu está no disco do host', r.out.trim() === 'persistente', r.out);
    r = await R('docker run --rm -v meus-dados:/outro alpine cat /outro/arquivo.txt');
    T('outro container monta o mesmo volume e vê o dado', r.out.trim() === 'persistente', r.out);
    r = await R('docker volume rm meus-dados');
    T('volume sem uso pode ser removido', r.status === 0);

    await R('docker volume create em-uso');
    await R('docker run -d --name usa -v em-uso:/d alpine sleep 999 2>/dev/null; true');
    await R('docker create --name usa2 -v em-uso:/d alpine true');
    r = await R('docker volume rm em-uso');
    T('volume em uso não pode ser removido', r.status !== 0 && /volume is in use/.test(r.out), r.out);
    await R('docker rm -f usa usa2 2>/dev/null; true');

    /* bind mount */
    await R('mkdir -p /home/aluno/site && echo "<h1>meu site</h1>" > /home/aluno/site/index.html');
    await R('docker run -d --name bindweb -p 8090:80 -v /home/aluno/site:/usr/share/nginx/html:ro nginx:alpine');
    r = await R('curl -s localhost:8090');
    T('bind mount serve o arquivo do host', /meu site/.test(r.out), r.out);
    await R('echo "<h1>editado</h1>" > /home/aluno/site/index.html');
    r = await R('curl -s localhost:8090');
    T('editar no host reflete no container na hora', /editado/.test(r.out), r.out);
    r = await R('docker inspect bindweb --format "{{range .Mounts}}{{.Type}} {{.Source}} {{.Destination}}{{end}}"');
    T('inspect descreve a montagem', /bind \/home\/aluno\/site \/usr\/share\/nginx\/html/.test(r.out), r.out);
    await R('docker rm -f bindweb');

    /* -v cria a pasta que falta; --mount recusa */
    r = await R('docker run --rm --mount type=bind,src=/home/aluno/nao-existe-mesmo,dst=/x alpine true');
    T('--mount recusa origem inexistente', r.status !== 0 && /bind source path does not exist/.test(r.out), r.out);
    r = await R('docker run --rm -v /home/aluno/criada-pelo-docker:/x alpine true; ls -d /home/aluno/criada-pelo-docker');
    T('-v cria o diretório que não existe', /criada-pelo-docker/.test(r.out), r.out);

    /* apagar o container não apaga o volume nomeado */
    await R('docker run -d --name banco -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -e MARIADB_DATABASE=loja -v db-dados:/var/lib/mysql mariadb:11.4');
    await R('docker exec banco mariadb -uroot -pSENHA_DO_BANCO loja -e "CREATE TABLE clientes (id INT PRIMARY KEY, nome VARCHAR(50)); INSERT INTO clientes VALUES (1,\'ana\');"');
    await R('docker rm -f banco');
    await R('docker run -d --name banco2 -e MARIADB_ROOT_PASSWORD=SENHA_DO_BANCO -v db-dados:/var/lib/mysql mariadb:11.4');
    r = await R('docker exec banco2 mariadb -uroot -pSENHA_DO_BANCO loja -N -B -e "SELECT nome FROM clientes;"');
    T('container apagado não é dado apagado: o volume guardou', r.out.trim() === 'ana', r.out);
    await R('docker rm -f banco2');
  }

  grupo('8. redes');
  {
    let r = await R('docker network ls');
    T('as três redes padrão existem', /bridge/.test(r.out) && /\bhost\b/.test(r.out) && /\bnone\b/.test(r.out), r.out);
    r = await R('docker network create minha-rede');
    T('network create devolve o id', /^[0-9a-f]{64}$/.test(r.out.trim()), r.out);
    await R('docker run -d --name a1 --network minha-rede nginx:alpine');
    await R('docker run -d --name a2 --network minha-rede nginx:alpine');
    r = await R('docker exec a2 wget -qO- http://a1/ | head -1');
    T('rede definida pelo usuário resolve nome de container', /DOCTYPE/.test(r.out), r.out);
    await R('docker run -d --name b1 nginx:alpine');
    await R('docker run -d --name b2 nginx:alpine');
    r = await R('docker exec b2 wget -qO- http://b1/');
    T('a bridge padrão NÃO resolve nomes', r.status !== 0 && /unable to resolve/.test(r.out), r.out);
    r = await R('docker network connect minha-rede b2 && docker exec b2 wget -qO- http://a1/ | head -1');
    T('conectar na rede certa resolve o problema', /DOCTYPE/.test(r.out), r.out);
    r = await R('docker network inspect minha-rede --format "{{range .Containers}}{{.Name}} {{end}}"');
    T('network inspect lista quem está na rede', /a1/.test(r.out) && /a2/.test(r.out), r.out);
    r = await R('docker network rm minha-rede');
    T('rede com container ligado não pode ser removida', r.status !== 0 && /active endpoints/.test(r.out), r.out);
    r = await R('docker network rm bridge');
    T('rede pré-definida não pode ser removida', r.status !== 0 && /pre-defined network/.test(r.out), r.out);
    await R('docker rm -f a1 a2 b1 b2');
    r = await R('docker network rm minha-rede');
    T('sem containers, a rede sai', r.status === 0, r.out);

    /* porta interna vs publicada */
    await R('docker network create interna');
    await R('docker run -d --name oculto --network interna nginx:alpine');
    r = await R('curl -s -m 2 localhost:80');
    T('sem -p a porta do container não existe no host', r.status !== 0, r.out);
    await R('docker rm -f oculto && docker network rm interna');
  }

  grupo('9. healthcheck e dependências');
  {
    await R('docker run -d --name saude --health-cmd "test -f /tmp/pronto" -e X=1 nginx:alpine');
    let r = await R('docker ps --filter name=saude --format "{{.Status}}"');
    T('healthcheck falhando aparece no status', /health: starting|unhealthy/.test(r.out), r.out);
    await R('docker exec saude touch /tmp/pronto');
    r = await R('docker ps --filter name=saude --format "{{.Status}}"');
    T('quando o teste passa, vira healthy', /healthy/.test(r.out), r.out);
    r = await R('docker inspect saude --format "{{.State.Health.Status}}"');
    T('inspect também mostra a saúde', r.out.trim() === 'healthy', r.out);
    await R('docker rm -f saude');
  }

  grupo('10. políticas de reinício');
  {
    /* mariadb sem senha morre na largada: com restart, tenta de novo */
    let r = await R('docker run -d --name semSenha mariadb:11.4');
    r = await R('docker ps -a --filter name=semSenha --format "{{.State}}"');
    T('sem MARIADB_ROOT_PASSWORD o banco não sobe', r.out.trim() === 'exited', r.out);
    r = await R('docker logs semSenha');
    T('e o log diz exatamente por quê', /password option is not specified/.test(r.out), r.out);
    await R('docker rm -f semSenha');
    r = await R('docker run -d --name reinicia --restart on-failure:3 mariadb:11.4');
    r = await R('docker inspect reinicia --format "{{.RestartCount}} {{.HostConfig.RestartPolicy.Name}}"');
    T('on-failure tenta de novo e conta as tentativas', /^3 on-failure$/.test(r.out.trim()), r.out);
    await R('docker rm -f reinicia');
  }

  grupo('11. cópias, diff e inspeção');
  {
    await R('docker run -d --name insp nginx:alpine');
    await R('echo "arquivo do host" > /home/aluno/enviado.txt');
    let r = await R('docker cp /home/aluno/enviado.txt insp:/tmp/enviado.txt && docker exec insp cat /tmp/enviado.txt');
    T('docker cp leva um arquivo para dentro', /arquivo do host/.test(r.out), r.out);
    r = await R('docker cp insp:/etc/nginx/nginx.conf /home/aluno/nginx-copia.conf && head -1 /home/aluno/nginx-copia.conf');
    T('docker cp traz um arquivo de dentro', /user\s+nginx/.test(r.out), r.out);
    r = await R('docker diff insp');
    T('diff aponta o que mudou na camada gravável', /A \/tmp\/enviado\.txt/.test(r.out), r.out);
    r = await R('docker inspect insp --format "{{.Config.Image}} {{.State.Running}}"');
    T('inspect --format lê campos aninhados', /nginx:alpine true/.test(r.out), r.out);
    r = await R('docker inspect insp --format "{{.NetworkSettings.IPAddress}}"');
    T('inspect entrega o IP do container', /^\d+\.\d+\.\d+\.\d+$/.test(r.out.trim()), r.out);
    r = await R('docker rename insp renomeado && docker ps --format "{{.Names}}" --filter name=renomeado');
    T('rename troca o nome', r.out.trim() === 'renomeado', r.out);
    await R('docker rm -f renomeado');
  }

  grupo('12. espaço em disco e limpeza');
  {
    let r = await R('docker system df');
    T('system df separa imagens, containers, volumes e cache',
      /Images/.test(r.out) && /Containers/.test(r.out) && /Local Volumes/.test(r.out) && /Build Cache/.test(r.out), r.out);
    await R('docker run --name lixo1 alpine true');
    await R('docker run --name lixo2 alpine true');
    r = await R('docker system prune -f');
    T('prune remove containers parados', /lixo1|Deleted Containers/.test(r.out) || r.status === 0, r.out);
    r = await R('docker ps -a --format "{{.Names}}"');
    T('os containers parados sumiram', !/lixo1/.test(r.out) && !/lixo2/.test(r.out), r.out);
    r = await R('docker volume ls -q');
    T('prune sem --volumes não toca nos volumes nomeados', /db-dados/.test(r.out), r.out);
  }

  grupo('13. Dockerfile e build');
  {
    await R('mkdir -p /home/aluno/proj && cd /home/aluno/proj');
    await R(`cat > /home/aluno/proj/index.js <<'FIM'
console.log("versao " + (process.env.VERSAO || "sem versao"));
FIM`);
    await R(`cat > /home/aluno/proj/package.json <<'FIM'
{"name":"app","version":"1.0.0","scripts":{"start":"node index.js"}}
FIM`);
    await R(`cat > /home/aluno/proj/segredo.txt <<'FIM'
nao deveria entrar na imagem
FIM`);
    await R(`cat > /home/aluno/proj/.dockerignore <<'FIM'
segredo.txt
node_modules
FIM`);
    await R(`cat > /home/aluno/proj/Dockerfile <<'FIM'
# syntax=docker/dockerfile:1
FROM node:22-alpine
LABEL org.opencontainers.image.authors="turma@exemplo.test"
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV VERSAO=1.4.2
EXPOSE 3000
USER node
CMD ["node", "index.js"]
FIM`);
    let r = await R('cd /home/aluno/proj && docker build -t app:1.0 .');
    T('build termina com sucesso', r.status === 0 && /FINISHED/.test(r.out), r.out);
    T('a saída mostra os passos numerados', /\[1\/\d+\] FROM/.test(r.out) && /COPY package.json/.test(r.out), r.out);
    r = await R('docker run --rm app:1.0');
    T('a imagem construída roda o CMD', /versao 1\.4\.2/.test(r.out), r.out);
    r = await R('docker run --rm app:1.0 ls /app');
    T('.dockerignore manteve o arquivo fora da imagem', !/segredo\.txt/.test(r.out), r.out);
    r = await R('docker run --rm app:1.0 whoami');
    T('USER vale em tempo de execução', r.out.trim() === 'node', r.out);
    r = await R('docker inspect app:1.0 --format "{{.Config.WorkingDir}} {{json .Config.ExposedPorts}} {{index .Config.Labels \\"org.opencontainers.image.authors\\"}}"');
    T('WORKDIR e EXPOSE ficam gravados na imagem', /\/app \{"3000\/tcp":\{\}\}/.test(r.out), r.out);

    /* avisos do BuildKit */
    await R(`cat > /home/aluno/proj/Dockerfile.velho <<'FIM'
FROM alpine:3.21
MAINTAINER alguem@exemplo.test
ENV APP_ENV producao
CMD echo ola
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.velho -t velho:1 .');
    T('o build avisa sobre ENV no formato antigo', /LegacyKeyValueFormat/.test(r.out), r.out);
    T('o build avisa que MAINTAINER está obsoleto', /MaintainerDeprecated/.test(r.out), r.out);
    T('o build avisa sobre CMD em shell form', /JSONArgsRecommended/.test(r.out), r.out);

    /* erros de build */
    await R(`cat > /home/aluno/proj/Dockerfile.ruim <<'FIM'
FROM alpine:3.21
COPY naoexiste.txt /app/
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.ruim -t ruim:1 .');
    T('COPY de arquivo ausente quebra o build', r.status !== 0 && /not found/.test(r.out), r.out);
    await R(`cat > /home/aluno/proj/Dockerfile.falha <<'FIM'
FROM alpine:3.21
RUN test -f /nao-existe
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.falha -t falha:1 .');
    T('RUN que falha interrompe o build com o código de saída', r.status !== 0 && /did not complete successfully/.test(r.out), r.out);
    await R(`cat > /home/aluno/proj/Dockerfile.semfrom <<'FIM'
RUN echo ola
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.semfrom -t x:1 .');
    T('Dockerfile sem FROM é recusado', r.status !== 0 && /FROM/.test(r.out), r.out);

    /* multi-stage */
    await R(`cat > /home/aluno/proj/Dockerfile.multi <<'FIM'
FROM node:22-alpine AS construcao
WORKDIR /src
COPY package.json index.js ./
RUN npm install && echo "artefato pronto" > /src/dist.txt

FROM alpine:3.21 AS producao
WORKDIR /app
COPY --from=construcao /src/dist.txt ./dist.txt
CMD ["cat", "/app/dist.txt"]
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.multi -t multi:1 .');
    T('multi-stage constrói', r.status === 0, r.out);
    r = await R('docker run --rm multi:1');
    T('COPY --from traz o artefato do outro estágio', /artefato pronto/.test(r.out), r.out);
    r = await R('docker run --rm multi:1 sh -c "ls /src 2>/dev/null || echo sem-src"');
    T('o estágio de construção não vai para a imagem final', /sem-src/.test(r.out), r.out);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.multi --target construcao -t so-build:1 . && docker run --rm so-build:1 ls /src');
    T('--target para no estágio pedido', /dist\.txt/.test(r.out), r.out);

    /* build args */
    await R(`cat > /home/aluno/proj/Dockerfile.arg <<'FIM'
FROM alpine:3.21
ARG VERSAO_APP=0.0.0
ENV VERSAO_APP=$VERSAO_APP
CMD ["sh", "-c", "echo $VERSAO_APP"]
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.arg -t arg:1 . && docker run --rm arg:1');
    T('ARG tem valor padrão', r.out.trim().endsWith('0.0.0'), r.out.slice(-80));
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.arg --build-arg VERSAO_APP=2.5.0 -t arg:2 . && docker run --rm arg:2');
    T('--build-arg sobrescreve o ARG', r.out.trim().endsWith('2.5.0'), r.out.slice(-80));
    r = await R("docker run --rm arg:1 sh -c 'echo [$VERSAO_APP]'");
    T('ENV chega no container (ARG sozinho não chegaria)', /\[0\.0\.0\]/.test(r.out), r.out);

    /* HEALTHCHECK no Dockerfile */
    await R(`cat > /home/aluno/proj/Dockerfile.hc <<'FIM'
FROM nginx:alpine
HEALTHCHECK --interval=5s --retries=2 CMD test -f /tmp/ok
FIM`);
    r = await R('cd /home/aluno/proj && docker build -f Dockerfile.hc -t hc:1 . && docker run -d --name comhc hc:1 && docker inspect comhc --format "{{.State.Health.Status}}"');
    T('o healthcheck da imagem entra em vigor', /starting|unhealthy/.test(r.out.trim().split('\n').pop()), r.out.slice(-200));
    await R('docker exec comhc touch /tmp/ok');
    r = await R('docker inspect comhc --format "{{.State.Health.Status}}"');
    T('e passa a healthy quando o teste passa', r.out.trim() === 'healthy', r.out);
    await R('docker rm -f comhc');
  }

  grupo('14. save, load e transporte');
  {
    let r = await R('docker save -o /home/aluno/app.tar app:1.0 && ls -l /home/aluno/app.tar');
    T('save grava o arquivo', /app\.tar/.test(r.out), r.out);
    await R('docker rmi -f app:1.0');
    r = await R('docker images -q app:1.0');
    T('a imagem saiu da máquina', r.out.trim() === '', r.out);
    r = await R('docker load -i /home/aluno/app.tar');
    T('load traz a imagem de volta', /Loaded image: app:1\.0/.test(r.out), r.out);
    r = await R('docker run --rm app:1.0');
    T('e ela funciona igual', /versao 1\.4\.2/.test(r.out), r.out);
    r = await R('docker load -i /home/aluno/vars.env');
    T('load de arquivo que não é imagem falha', r.status !== 0 && /invalid tar header/.test(r.out), r.out);
  }

  grupo('15. Compose');
  {
    await R('mkdir -p /home/aluno/pilha');
    await R(`cat > /home/aluno/pilha/.env <<'FIM'
SENHA_DO_BANCO=senha-de-exemplo
PORTA=8100
FIM`);
    await R(`cat > /home/aluno/pilha/compose.yaml <<'FIM'
name: pilha

services:
  web:
    image: nginx:alpine
    ports:
      - "\${PORTA}:80"
    depends_on:
      db:
        condition: service_healthy
    networks: [frente, fundo]

  db:
    image: mariadb:11.4
    environment:
      MARIADB_ROOT_PASSWORD: \${SENHA_DO_BANCO:?defina a senha}
      MARIADB_DATABASE: loja
    volumes:
      - dados:/var/lib/mysql
    networks: [fundo]
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h localhost || exit 1"]
      retries: 5
    restart: unless-stopped

networks:
  frente:
  fundo:

volumes:
  dados:
FIM`);
    let r = await R('cd /home/aluno/pilha && docker compose config');
    T('compose config renderiza o arquivo final', /name: pilha/.test(r.out) && /senha-de-exemplo/.test(r.out), r.out);
    T('config resolve a interpolação da porta', /published: "8100"/.test(r.out), r.out);
    r = await R('cd /home/aluno/pilha && docker compose up -d');
    T('compose up sobe a stack', r.status === 0 && /Started/.test(r.out), r.out);
    r = await R('docker ps --format "{{.Names}}"');
    T('os nomes seguem projeto-servico-1', /pilha-db-1/.test(r.out) && /pilha-web-1/.test(r.out), r.out);
    r = await R('curl -s -o /dev/null -w "%{http_code}" localhost:8100');
    T('a porta do compose responde', r.out.trim() === '200', r.out);
    r = await R('cd /home/aluno/pilha && docker compose ps');
    T('compose ps mostra saúde', /healthy/.test(r.out), r.out);
    r = await R('cd /home/aluno/pilha && docker compose logs db --tail 1');
    T('compose logs prefixa com o serviço', /^db-1\s+\|/m.test(r.out), r.out);
    r = await R('docker exec pilha-web-1 wget -qO- http://db:3306 2>&1 | head -1; docker exec pilha-web-1 ping -c1 db');
    T('web resolve o serviço db pelo nome', /PING db/.test(r.out), r.out);
    r = await R('cd /home/aluno/pilha && docker compose exec db mariadb -uroot -psenha-de-exemplo -N -B -e "SELECT 1;"');
    T('compose exec entra no container do serviço', r.out.trim() === '1', r.out);
    r = await R('cd /home/aluno/pilha && docker compose down');
    T('compose down remove containers e redes', /Removed/.test(r.out), r.out);
    r = await R('docker volume ls -q');
    T('down NÃO apaga o volume nomeado', /pilha_dados/.test(r.out), r.out);
    r = await R('cd /home/aluno/pilha && docker compose down -v');
    T('down -v apaga o volume', r.status === 0);
    r = await R('docker volume ls -q');
    T('e agora ele sumiu mesmo', !/pilha_dados/.test(r.out), r.out);

    /* variável obrigatória ausente */
    await R('cd /home/aluno/pilha && mv .env .env.bak');
    r = await R('cd /home/aluno/pilha && docker compose config');
    T('${VAR:?} aborta quando a variável falta', r.status !== 0 && /required variable SENHA_DO_BANCO/.test(r.out), r.out);
    await R('cd /home/aluno/pilha && mv .env.bak .env');

    /* version: obsoleto */
    await R(`cat > /home/aluno/pilha/velho.yaml <<'FIM'
version: "3.8"
services:
  eco:
    image: alpine:3.21
    command: ["echo", "ola"]
FIM`);
    r = await R('cd /home/aluno/pilha && docker compose -f velho.yaml config');
    T('compose avisa que version: é obsoleto', /version.*obsolete/.test(r.out), r.out);

    /* YAML com tabulação */
    await R('printf "services:\\n\\tweb:\\n\\t\\timage: alpine\\n" > /home/aluno/pilha/tab.yaml');
    r = await R('cd /home/aluno/pilha && docker compose -f tab.yaml config');
    T('tabulação no YAML é recusada com a linha do erro', r.status !== 0 && /tab|\\t/.test(r.out), r.out);
  }

  grupo('16. Traefik');
  {
    await R('mkdir -p /home/aluno/borda');
    await R(`cat > /home/aluno/borda/compose.yaml <<'FIM'
name: borda

services:
  traefik:
    image: traefik:v3.7
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--accesslog=true"
    ports: ["80:80"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [borda]

  site:
    image: traefik/whoami:v1.10
    networks: [borda]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.site.rule=Host(\`site.local\`)"
      - "traefik.http.routers.site.entrypoints=web"
      - "traefik.http.services.site.loadbalancer.server.port=80"

  api:
    image: traefik/whoami:v1.10
    environment:
      WHOAMI_PORT_NUMBER: "8080"
    networks: [borda]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(\`site.local\`) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.api.entrypoints=web"
      - "traefik.http.routers.api.priority=100"
      - "traefik.http.routers.api.middlewares=corta"
      - "traefik.http.services.api.loadbalancer.server.port=8080"
      - "traefik.http.middlewares.corta.stripprefix.prefixes=/api"

  invisivel:
    image: traefik/whoami:v1.10
    networks: [borda]

networks:
  borda:
FIM`);
    await R('cd /home/aluno/borda && docker compose up -d');
    let r = await R('curl -s -H "Host: site.local" http://localhost/');
    T('o router entrega no container certo', /Hostname: /.test(r.out), r.out);
    r = await R('curl -s -H "Host: site.local" http://localhost/api/teste');
    T('PathPrefix com prioridade escolhe a API', /GET \/teste/.test(r.out), r.out);
    T('stripPrefix removeu o /api antes de repassar', !/GET \/api/.test(r.out), r.out);
    r = await R('curl -s -H "Host: outro.local" http://localhost/');
    T('host sem rota devolve 404 do Traefik', /404 page not found/.test(r.out), r.out);
    r = await R('cd /home/aluno/borda && docker compose logs traefik --tail 20');
    T('o access log registra as requisições', /"GET \/api\/teste HTTP\/1.1" 200/.test(r.out), r.out);

    /* exposedByDefault=false: quem não pediu não entra */
    const rotas = LX.traefikRotas(eng.containerPorNome('borda-traefik-1'), eng);
    T('o container sem traefik.enable fica de fora', !Array.from(rotas.routers.keys()).includes('invisivel'),
      Array.from(rotas.routers.keys()).join(','));

    /* 502: porta errada no label */
    await R(`cat > /home/aluno/borda/quebrado.yaml <<'FIM'
name: quebrado

services:
  errado:
    image: traefik/whoami:v1.10
    networks: [borda]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.errado.rule=Host(\`errado.local\`)"
      - "traefik.http.routers.errado.entrypoints=web"
      - "traefik.http.services.errado.loadbalancer.server.port=9999"

networks:
  borda:
    name: borda_borda
    external: true
FIM`);
    await R('cd /home/aluno/borda && docker compose -f quebrado.yaml up -d');
    r = await R('curl -s -H "Host: errado.local" http://localhost/');
    T('porta errada no label devolve 502', /Bad Gateway/.test(r.out), r.out);
    r = await R('cd /home/aluno/borda && docker compose logs traefik --tail 5');
    T('e o log do Traefik explica a recusa', /connection refused/.test(r.out), r.out);
    await R('cd /home/aluno/borda && docker compose -f quebrado.yaml down');

    /* rede errada */
    await R("docker run -d --name fora --label traefik.enable=true --label 'traefik.http.routers.fora.rule=Host(`fora.local`)' --label traefik.http.services.fora.loadbalancer.server.port=80 traefik/whoami:v1.10");
    r = await R('curl -s -H "Host: fora.local" http://localhost/');
    T('container em outra rede que o Traefik dá 502', /Bad Gateway/.test(r.out), r.out);
    await R('docker rm -f fora');
    await R('cd /home/aluno/borda && docker compose down');
  }

  grupo('17. eventos e o que o daemon registrou');
  {
    const r = await R('docker events --since 1h');
    T('events lista o histórico do daemon', /container (create|start)/.test(r.out), r.out.slice(0, 200));
  }

  grupo('18. YAML 1.2 e sobreposição de arquivos');
  {
    /* esquema core do YAML 1.2 — o mesmo do yaml.v3 usado pelo Compose v2 */
    const y = LX.lerYaml([
      'a: no', 'b: yes', 'c: 22:30', 'd: 0755', 'e: 007',
      'f: true', 'g: "8080"', 'h: 8080', 'i: 1.10', 'j: null'
    ].join('\n'));
    T('`no` e `yes` são texto (não YAML 1.1)', y.a === 'no' && y.b === 'yes', JSON.stringify(y));
    T('`22:30` é texto, não sexagesimal', y.c === '22:30', y.c);
    T('`0755` é decimal 755, não octal', y.d === 755, y.d);
    T('`007` perde os zeros e vira 7', y.e === 7, y.e);
    T('`true` é booleano', y.f === true, y.f);
    T('aspas mantêm o texto', y.g === '8080' && y.h === 8080, JSON.stringify([y.g, y.h]));
    T('`1.10` vira 1.1', y.i === 1.1, y.i);
    T('`null` vira nulo', y.j === null, y.j);

    /* COPY de diretório leva o CONTEÚDO para o destino */
    await R('mkdir -p /home/aluno/cpdir/publico');
    await R('echo conteudo-copiado > /home/aluno/cpdir/publico/index.html');
    await R("printf 'FROM nginx:alpine\\nCOPY publico/ /usr/share/nginx/html/\\n' > /home/aluno/cpdir/Dockerfile");
    let r = await R('cd /home/aluno/cpdir && docker build -q -t cpdir:1 .');
    T('COPY aceita origem com barra no fim', !/not found/.test(r.out), r.out);
    r = await R('docker run --rm cpdir:1 cat /usr/share/nginx/html/index.html');
    T('o conteúdo do diretório vai para o destino, sem recriar a pasta',
      /conteudo-copiado/.test(r.out), r.out);
    r = await R('docker run --rm cpdir:1 ls /usr/share/nginx/html');
    T('a pasta de origem não é recriada dentro do destino', !/publico/.test(r.out), r.out);

    /* compose.override.yaml entra automaticamente */
    await R('mkdir -p /home/aluno/sobrep');
    await R("printf 'services:\\n  site:\\n    image: nginx:alpine\\n    restart: unless-stopped\\n' > /home/aluno/sobrep/compose.yaml");
    await R("printf 'services:\\n  site:\\n    ports:\\n      - \"8199:80\"\\n' > /home/aluno/sobrep/compose.override.yaml");
    r = await R('cd /home/aluno/sobrep && docker compose config');
    T('o override é carregado sem -f', /8199/.test(r.out) && /unless-stopped/.test(r.out), r.out);
    await R('cd /home/aluno/sobrep && docker compose up -d');
    r = await R('curl -s -o /dev/null -w "%{http_code}" http://localhost:8199/');
    T('a stack sobe com a porta vinda do override', /200/.test(r.out), r.out);
    await R('cd /home/aluno/sobrep && docker compose down');
  }

  console.log(`\n=== docker: ${ok} passaram · ${mau} falharam ===\n`);
  process.exit(mau ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
