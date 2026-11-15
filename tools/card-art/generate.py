"""
Generates an illustration for each card with the OpenAI image API (gpt-image), for the art window
of the card ("printed" and "arena" card skins).

The pictures are new illustrations made from the card's name, tags and text. They are not copies of
the printed cards' artwork, and the prompt never asks for them.

Usage (from the project folder; the key is read from the OPENAI_API_KEY environment variable):

  python tools/card-art/generate.py --limit 50              # first 50 project cards without art
  python tools/card-art/generate.py --modules base,corpera  # only these expansions
  python tools/card-art/generate.py --only "Comet;Lichen"   # only these cards
  python tools/card-art/generate.py --dry-run --limit 5     # print the prompts, no API calls
  python tools/card-art/generate.py --lore --limit 50       # background texts instead of pictures

Background texts (--lore): two or three sentences in Polish, written new for each card (not the
quotes printed on the cards), saved in src/client/cards/cardLore.json and shown beside a card
viewed up close.

Output: assets/cards/<card-slug>.jpg (768 x 512) and src/client/cards/cardArt.json, the list of
cards that have a picture (bundled with the client). Cards that already have a picture are skipped.
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CARDS_JSON = os.path.join(ROOT, 'src', 'genfiles', 'cards.json')
OUT_DIR = os.path.join(ROOT, 'assets', 'cards')
MANIFEST = os.path.join(ROOT, 'src', 'client', 'cards', 'cardArt.json')
API_URL = 'https://api.openai.com/v1/images/generations'
CHAT_URL = 'https://api.openai.com/v1/chat/completions'
LORE = os.path.join(ROOT, 'src', 'client', 'cards', 'cardLore.json')

STYLE = (
    'Painted science-fiction illustration for a board game card about the colonisation and '
    'terraforming of Mars in the near future. Realistic, slightly painterly digital art, believable '
    'NASA-style hardware and architecture, dramatic but natural light, rich colours with warm Martian '
    'reds and ochres where the scene is on Mars. Landscape composition with one clear subject. '
    'No text, no letters, no numbers, no logos, no captions, no card frame, no border, no icons.'
)

TAG_HINTS = {
    'building': 'construction on the Martian surface',
    'space': 'in space or orbit',
    'science': 'research and laboratories',
    'power': 'energy production',
    'earth': 'Earth or Earth-based organisations',
    'jovian': 'the Jupiter system and its moons',
    'venus': 'Venus and its clouds',
    'plant': 'plants and greenery',
    'microbe': 'microbes and microscopic life',
    'animal': 'animals',
    'city': 'a settlement or city',
    'moon': 'Earth\'s Moon',
    'mars': 'Mars',
    'wild': '',
    'event': 'a single dramatic event',
    'crime': 'crime and the underworld',
}


def slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def card_text(card: dict) -> str:
    """The card's printed text (description and effect sentences), shortened."""
    texts = []
    metadata = card.get('metadata', {})
    description = metadata.get('description')
    if isinstance(description, str):
        texts.append(description)
    elif isinstance(description, dict) and isinstance(description.get('text'), str):
        texts.append(description['text'])

    def walk(node):
        if isinstance(node, str):
            texts.append(node)
        elif isinstance(node, list):
            for child in node:
                walk(child)
        elif isinstance(node, dict):
            for key in ('rows', 'text'):
                if key in node:
                    walk(node[key])

    walk(metadata.get('renderData'))
    text = ' '.join(t for t in texts if len(t) > 3)
    return text[:400]


def prompt_for(card: dict) -> str:
    tags = [TAG_HINTS.get(tag, tag) for tag in card.get('tags', [])]
    tags = [t for t in tags if t]
    if card.get('type') == 'event':
        tags.append(TAG_HINTS['event'])
    parts = [f'Subject: "{card["name"]}".']
    if tags:
        parts.append('Themes: ' + ', '.join(dict.fromkeys(tags)) + '.')
    text = card_text(card)
    if text:
        parts.append('What the card does in the game (for context only, do not draw any text): ' + text)
    parts.append(STYLE)
    return ' '.join(parts)


def generate(card: dict, args) -> str:
    key = os.environ.get('OPENAI_API_KEY')
    body = json.dumps({
        'model': args.model,
        'prompt': prompt_for(card),
        'size': '1536x1024',
        'quality': args.quality,
        'n': 1,
    }).encode('utf8')
    for attempt in range(5):
        request = urllib.request.Request(API_URL, data=body, method='POST', headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        })
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                data = json.loads(response.read())
            break
        except urllib.error.HTTPError as error:
            detail = error.read().decode('utf8', 'replace')[:300]
            if error.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(10 * (attempt + 1))
                continue
            raise RuntimeError(f'HTTP {error.code}: {detail}') from None
    image = Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGB')
    image = image.resize((768, 512), Image.LANCZOS)
    path = os.path.join(OUT_DIR, slug(card['name']) + '.jpg')
    image.save(path, 'JPEG', quality=84, optimize=True, progressive=True)
    return path


def post_json(url: str, payload: dict) -> dict:
    body = json.dumps(payload).encode('utf8')
    for attempt in range(5):
        request = urllib.request.Request(url, data=body, method='POST', headers={
            'Authorization': f'Bearer {os.environ.get("OPENAI_API_KEY")}',
            'Content-Type': 'application/json',
        })
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            detail = error.read().decode('utf8', 'replace')[:300]
            if error.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(10 * (attempt + 1))
                continue
            raise RuntimeError(f'HTTP {error.code}: {detail}') from None
    raise RuntimeError('no answer')


def lore_for(card: dict, args) -> str:
    prompt = (
        f'Karta z gry planszowej o kolonizacji i terraformowaniu Marsa w niedalekiej przyszłości: "{card["name"]}". '
        f'Znaczniki: {", ".join(card.get("tags", [])) or "brak"}. Działanie w grze: {card_text(card)} '
        'Napisz po polsku 2-3 zdania genezy tej karty: skąd się wzięła, kto za nią stoi, jak wygląda w świecie gry. '
        'Pisz rzeczowo, jak notka z encyklopedii przyszłości. Nie cytuj tekstów z oryginalnych kart, wymyśl własny. '
        'Bez zasad gry, liczb z karty i nawiasów. Tylko sam tekst.'
    )
    data = post_json(CHAT_URL, {'model': args.text_model, 'messages': [{'role': 'user', 'content': prompt}]})
    return data['choices'][0]['message']['content'].strip()


def run_lore(todo: list, args) -> None:
    lore = {}
    if os.path.exists(LORE):
        with open(LORE, encoding='utf8') as f:
            lore = json.load(f)
    todo = [card for card in todo if card['name'] not in lore]
    if args.limit:
        todo = todo[:args.limit]
    print(f'{len(todo)} background texts to write')
    if args.dry_run:
        return
    done = 0
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futures = {pool.submit(lore_for, card, args): card for card in todo}
        for future in as_completed(futures):
            card = futures[future]
            try:
                lore[card['name']] = future.result()
                done += 1
                print(f'[{done}/{len(todo)}] {card["name"]}')
            except Exception as error:  # noqa: BLE001 - report and go on with the other cards
                print(f'{card["name"]} FAILED: {error}')
            if done % 20 == 0:
                save_lore(lore)
    save_lore(lore)


def save_lore(lore: dict) -> None:
    with open(LORE, 'w', encoding='utf8', newline='\n') as f:
        json.dump(dict(sorted(lore.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')


def write_manifest(cards: list) -> None:
    have = sorted(card['name'] for card in cards if os.path.exists(os.path.join(OUT_DIR, slug(card['name']) + '.jpg')))
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w', encoding='utf8', newline='\n') as f:
        json.dump(have, f, ensure_ascii=False, indent=0)
        f.write('\n')
    print(f'{len(have)} cards have a picture ({os.path.relpath(MANIFEST, ROOT)})')


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate card illustrations with the OpenAI image API.')
    parser.add_argument('--types', default='automated,active,event', help='card types (default: project cards)')
    parser.add_argument('--modules', default='', help='expansions, e.g. base,corpera,prelude (default: all)')
    parser.add_argument('--only', default='', help='card names separated by ";"')
    parser.add_argument('--limit', type=int, default=0, help='at most this many new pictures')
    parser.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    parser.add_argument('--model', default='gpt-image-1')
    parser.add_argument('--concurrency', type=int, default=3)
    parser.add_argument('--dry-run', action='store_true', help='print the prompts only')
    parser.add_argument('--lore', action='store_true', help='write background texts instead of pictures')
    parser.add_argument('--text-model', default='gpt-4.1-mini', help='model for the background texts')
    args = parser.parse_args()

    with open(CARDS_JSON, encoding='utf8') as f:
        cards = json.load(f)
    types = set(filter(None, args.types.split(',')))
    modules = set(filter(None, args.modules.split(',')))
    only = set(filter(None, (name.strip() for name in args.only.split(';'))))

    wanted = [card for card in cards
              if (only and card['name'] in only) or
              (not only and card.get('type') in types and (not modules or card.get('module') in modules))]
    if args.lore:
        if not args.dry_run and not os.environ.get('OPENAI_API_KEY'):
            sys.exit('Set the OPENAI_API_KEY environment variable first.')
        run_lore(wanted, args)
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    todo = [card for card in wanted if not os.path.exists(os.path.join(OUT_DIR, slug(card['name']) + '.jpg'))]
    if args.limit:
        todo = todo[:args.limit]
    print(f'{len(wanted)} cards selected, {len(todo)} to generate')

    if args.dry_run:
        for card in todo:
            print(f'\n[{card["name"]}]\n{prompt_for(card)}')
        return
    if not os.environ.get('OPENAI_API_KEY'):
        sys.exit('Set the OPENAI_API_KEY environment variable first.')

    done = failed = 0
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futures = {pool.submit(generate, card, args): card for card in todo}
        for future in as_completed(futures):
            card = futures[future]
            try:
                future.result()
                done += 1
                print(f'[{done + failed}/{len(todo)}] {card["name"]}')
            except Exception as error:  # noqa: BLE001 - report and go on with the other cards
                failed += 1
                print(f'[{done + failed}/{len(todo)}] {card["name"]} FAILED: {error}')
    print(f'Done: {done} generated, {failed} failed')
    write_manifest(cards)


if __name__ == '__main__':
    main()
