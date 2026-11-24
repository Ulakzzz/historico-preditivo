"""Criptografia dos dados do site Histórico Preditivo.

Formato (o mesmo que a página lê no navegador):
  dados/chave.json  -> chave de dados (AES-256) protegida pela senha:
                       PBKDF2-SHA256(senha, salt, iter) -> AES-GCM(iv) da chave de dados
  dados/*.enc       -> iv (12 bytes) + AES-GCM(chave de dados, planilha .xlsx original)
  dados/config/*.enc-> planilha de padronização (Padronizacao.xlsx)
  dados/manifest.json -> lista dos .enc (gerada por este script)

A chave de dados é lida da variável de ambiente HP_CHAVE (base64). Ela nunca é gravada no site.

Planilhas novas (rotinas automáticas, sem segredo nenhum):
  dados/publica.pem -> chave pública RSA-OAEP (SHA-256)
  dados/privada.enc -> chave privada correspondente (PKCS8), cifrada com a chave de dados
  arquivo "HPR1"    -> 'HPR1' + tamanho (2 bytes) + chave do arquivo cifrada com RSA + iv (12) + AES-GCM
  A página abre a chave privada com a senha e então lê esses arquivos.

Uso:
  python ferramentas/cifrar.py init  --senha "SENHA"        # cria chave.json e imprime HP_CHAVE (guarde!)
  python ferramentas/cifrar.py add   planilha.xlsx [...]    # cifra planilhas de dados (HP_CHAVE)
  python ferramentas/cifrar.py config Padronizacao.xlsx     # cifra a planilha de padronização (HP_CHAVE)
  python ferramentas/cifrar.py senha --nova "NOVA"          # troca a senha sem recifrar os dados (HP_CHAVE)
  python ferramentas/cifrar.py chaves-rsa                   # cria publica.pem/privada.enc (HP_CHAVE, uma vez)
  python ferramentas/cifrar.py add-publico planilha.xlsx    # cifra com a chave pública (NÃO precisa de HP_CHAVE)
  python ferramentas/cifrar.py manifest                     # só regenera o manifest.json
"""
import argparse, base64, datetime, hashlib, json, os, sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, 'dados')
ITER = 310000


def b64(b): return base64.b64encode(b).decode()


def chave_dados():
    k = os.environ.get('HP_CHAVE', '').strip()
    if not k:
        sys.exit('Defina a variável de ambiente HP_CHAVE com a chave de dados (base64).')
    raw = base64.b64decode(k)
    if len(raw) != 32:
        sys.exit('HP_CHAVE inválida (precisa ter 32 bytes).')
    return raw


def kek(senha, salt, it):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=it).derive(senha.encode('utf-8'))


def gravar_chave(raw, senha):
    salt, iv = os.urandom(16), os.urandom(12)
    wrapped = AESGCM(kek(senha, salt, ITER)).encrypt(iv, raw, None)
    os.makedirs(DADOS, exist_ok=True)
    with open(os.path.join(DADOS, 'chave.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'kdf': 'PBKDF2-SHA256', 'iter': ITER, 'salt': b64(salt), 'iv': b64(iv), 'wrapped': b64(wrapped)}, f, indent=1)


def cifrar(caminho, destino_dir):
    raw = chave_dados()
    with open(caminho, 'rb') as f:
        dados = f.read()
    iv = os.urandom(12)
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, os.path.basename(caminho) + '.enc')
    with open(destino, 'wb') as f:
        f.write(iv + AESGCM(raw).encrypt(iv, dados, None))
    print('cifrado:', os.path.relpath(destino, RAIZ))


OAEP = padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def chaves_rsa():
    raw = chave_dados()
    if os.path.exists(os.path.join(DADOS, 'publica.pem')):
        sys.exit('dados/publica.pem já existe.')
    priv = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    der = priv.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    iv = os.urandom(12)
    with open(os.path.join(DADOS, 'privada.enc'), 'wb') as f:
        f.write(iv + AESGCM(raw).encrypt(iv, der, None))
    with open(os.path.join(DADOS, 'publica.pem'), 'wb') as f:
        f.write(priv.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    print('criados: dados/publica.pem e dados/privada.enc')


def cifrar_publico(caminho, destino_dir):
    with open(os.path.join(DADOS, 'publica.pem'), 'rb') as f:
        pub = serialization.load_pem_public_key(f.read())
    with open(caminho, 'rb') as f:
        dados = f.read()
    k, iv = os.urandom(32), os.urandom(12)
    wrapped = pub.encrypt(k, OAEP)
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, os.path.basename(caminho) + '.enc')
    with open(destino, 'wb') as f:
        f.write(b'HPR1' + len(wrapped).to_bytes(2, 'big') + wrapped + iv + AESGCM(k).encrypt(iv, dados, None))
    print('cifrado (chave pública):', os.path.relpath(destino, RAIZ))


def manifest():
    arquivos = []
    for pasta, _, nomes in os.walk(DADOS):
        for n in sorted(nomes):
            if not n.endswith('.enc') or (pasta == DADOS and n == 'privada.enc'):
                continue
            p = os.path.join(pasta, n)
            rel = os.path.relpath(p, DADOS).replace(os.sep, '/')
            with open(p, 'rb') as f:
                sha = hashlib.sha256(f.read()).hexdigest()[:16]
            arquivos.append({'nome': n[:-4], 'arquivo': rel, 'tipo': 'config' if rel.startswith('config/') else 'dados', 'sha': sha})
    arquivos.sort(key=lambda a: (a['tipo'] != 'config', a['nome']))
    m = {'atualizado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'arquivos': arquivos}
    with open(os.path.join(DADOS, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    print('manifest.json:', len(arquivos), 'arquivo(s)')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('init'); p.add_argument('--senha', required=True)
    p = sub.add_parser('add'); p.add_argument('arquivos', nargs='+')
    p = sub.add_parser('config'); p.add_argument('arquivo')
    p = sub.add_parser('senha'); p.add_argument('--nova', required=True)
    sub.add_parser('chaves-rsa')
    p = sub.add_parser('add-publico'); p.add_argument('arquivos', nargs='+')
    sub.add_parser('manifest')
    a = ap.parse_args()
    if a.cmd == 'init':
        if os.path.exists(os.path.join(DADOS, 'chave.json')):
            sys.exit('dados/chave.json já existe. Para trocar a senha use: senha --nova')
        raw = os.urandom(32)
        gravar_chave(raw, a.senha)
        print('HP_CHAVE=' + b64(raw))
    elif a.cmd == 'add':
        for x in a.arquivos:
            cifrar(x, DADOS)
        manifest()
    elif a.cmd == 'config':
        cifrar(a.arquivo, os.path.join(DADOS, 'config'))
        manifest()
    elif a.cmd == 'chaves-rsa':
        chaves_rsa()
    elif a.cmd == 'add-publico':
        for x in a.arquivos:
            cifrar_publico(x, DADOS)
        manifest()
    elif a.cmd == 'senha':
        gravar_chave(chave_dados(), a.nova)
        print('senha trocada (dados/chave.json)')
    else:
        manifest()


if __name__ == '__main__':
    main()
