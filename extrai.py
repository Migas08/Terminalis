import json
p = '/root/.claude/projects/-home-claude/cbdd75f0-a593-5fff-b287-0d2c38fb12f5/tool-results/toolu_0195tLmrdKyo4rnUnnRNsKcR.json'
d = json.load(open(p))
t = d[0]['text'] if isinstance(d, list) else d['text']
open('/home/claude/curso/pesquisa-compose-traefik.md', 'w').write(t)
print(len(t))
