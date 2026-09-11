'use strict';
(function(){
  LX.Settings={
    apply(){const s=LX.Progress.data.settings||{};document.documentElement.style.setProperty('--reading-size',(s.readingSize||16)+'px');document.documentElement.classList.toggle('reduce-motion',!!s.reduceMotion);},
    render(app){
      const s=LX.Progress.data.settings||{};
      document.querySelector('#page').innerHTML=`<div class="doc"><div class="eyebrow">Seu espaço de estudo</div><h1 class="title">Configurações</h1><p class="lede">Ajuste a leitura e consulte como seu trabalho é salvo.</p><label class="settings-row"><span>Tamanho do texto</span><select id="reading-size"><option value="16">Padrão — 16 px</option><option value="18">Grande — 18 px</option><option value="20">Maior — 20 px</option></select></label><label class="settings-row"><span>Reduzir animações</span><input type="checkbox" id="reduce-motion"></label><p role="status" id="settings-feedback"></p><h2>Progresso e laboratório</h2><p>Aulas, atividades, anotações e preferências são salvas na sua conta de estudo. No modo local, esses dados ficam neste navegador; no modo Supabase, sincronizam entre computadores.</p><p>Com uma conta local, o laboratório é reiniciado ao recarregar a página. Com o Supabase configurado, arquivos, commits, staging, Docker e o diretório atual são restaurados automaticamente quando você entra.</p><button class="btn" id="settings-help">Abrir guia do terminal</button></div>`;
      const size=document.querySelector('#reading-size'),motion=document.querySelector('#reduce-motion');size.value=String(s.readingSize||16);motion.checked=!!s.reduceMotion;
      const save=()=>{LX.Progress.data.settings={readingSize:Number(size.value),reduceMotion:motion.checked};LX.Progress.save();this.apply();document.querySelector('#settings-feedback').textContent='Preferências salvas.';};size.onchange=save;motion.onchange=save;
      document.querySelector('#settings-help').onclick=()=>app.goPage('ajuda');
    }
  };
})();

