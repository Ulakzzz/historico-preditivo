"""Reinsere motor/motor.js no <script id="motor"> do index.html (e, se pedido, do HTML do SharePoint).

Uso: python ferramentas/embutir-motor.py [--sharepoint CAMINHO_HTML]

Os sites continuam arquivos únicos: o motor é copiado para dentro do HTML, com
VERSAO = sha256(motor/motor.js)[:10]. Se o marcador não existir, sai com código 1.
"""
import argparse
import hashlib
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MOTOR = RAIZ / 'motor' / 'motor.js'
MARCADOR = re.compile(rb'(<script id="motor">)(.*?)(</script>)', re.S)
VAZIA = b"var VERSAO = '';"


def embutir(html_path: Path, corpo: bytes) -> bool:
    html = html_path.read_bytes()
    achados = MARCADOR.findall(html)
    if len(achados) != 1:
        print(f'{html_path}: esperado 1 <script id="motor">, achados {len(achados)}', file=sys.stderr)
        return False
    novo = MARCADOR.sub(lambda m: m.group(1) + corpo + m.group(3), html, count=1)
    if novo != html:
        html_path.write_bytes(novo)
    print(f'{html_path}: motor embutido' + ('' if novo != html else ' (sem mudança)'))
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--sharepoint', help='HTML do SharePoint (HistoricoPreditivo.html) para atualizar também')
    a = ap.parse_args()

    fonte = MOTOR.read_bytes()
    if b'</script' in fonte.lower():
        print('motor.js não pode conter "</script"', file=sys.stderr)
        return 1
    if fonte.count(VAZIA) != 1:
        print(f'motor.js precisa ter exatamente uma linha {VAZIA.decode()}', file=sys.stderr)
        return 1
    versao = hashlib.sha256(fonte).hexdigest()[:10]
    corpo = b'\n' + fonte.replace(VAZIA, f"var VERSAO = '{versao}';".encode()).rstrip(b'\n') + b'\n'

    alvos = [RAIZ / 'index.html'] + ([Path(a.sharepoint)] if a.sharepoint else [])
    ok = all([embutir(p, corpo) for p in alvos])
    print('versão', versao)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
