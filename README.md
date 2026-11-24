# Histórico Preditivo

Site com o histórico de condição dos equipamentos (manutenção preditiva).

Os dados em `dados/` estão criptografados (AES-256-GCM). A página pede uma senha, abre a chave de dados (`dados/chave.json`, PBKDF2-SHA256 + AES-GCM) e decifra as planilhas no próprio navegador. Nada é decifrado no servidor.

- `index.html`: a aplicação.
- `dados/manifest.json`: lista das planilhas cifradas.
- `ferramentas/cifrar.py`: cifra novas planilhas e troca a senha. Precisa da chave de dados na variável `HP_CHAVE` (nunca grave essa chave no repositório).

```
pip install cryptography
HP_CHAVE=... python ferramentas/cifrar.py add Relatorios_extraidos_AAAA-MM-DD_HHMM.xlsx
HP_CHAVE=... python ferramentas/cifrar.py senha --nova "NOVA SENHA"
```
