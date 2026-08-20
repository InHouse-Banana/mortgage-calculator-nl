"""Regenerates public/og-image.png, the link-preview card.

Run from the repo root:

    curl -sL -o /tmp/Nunito.ttf \
      "https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bwght%5D.ttf"
    curl -sL -o /tmp/NunitoItalic.ttf \
      "https://github.com/google/fonts/raw/main/ofl/nunito/Nunito-Italic%5Bwght%5D.ttf"
    python3 scripts/generate-og-image.py

Kept as a script rather than a build step: the card changes once a year at most,
and this keeps Pillow and a font download out of the deploy path. Colours below
mirror src/index.css — update both together.
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CANVAS   = (239, 240, 235)   # --color-canvas
ACCENT   = (200, 97, 8)      # --color-accent  #c86108
BRAND500 = (77, 82, 92)      # --color-brand-500
BRAND400 = (96, 102, 114)
BRAND200 = (194, 197, 204)
WHITE    = (255, 255, 255)
CHART = [(89, 56, 147), (41, 123, 118), (196, 131, 32)]  # gross, capital, interest

def font(size, weight, italic=False):
    # The italic file names its instances "Bold Italic", not "Bold".
    path = '/tmp/NunitoItalic.ttf' if italic else '/tmp/Nunito.ttf'
    f = ImageFont.truetype(path, size)
    f.set_variation_by_name(f'{weight} Italic' if italic else weight)
    return f

img = Image.new('RGB', (W, H), CANVAS)
d = ImageDraw.Draw(img)

# Orange header block, mirroring the app's own banner.
M, TOP, BH = 64, 88, 300
d.rounded_rectangle([M, TOP, W - M, TOP + BH], radius=28, fill=ACCENT)

# "Mortgage Calculator Revised", with Revised in true italic — the same
# treatment as the h1 on the page, rather than a separate badge.
title_font = font(70, 'Bold')
italic_font = font(70, 'Bold', italic=True)
tx = M + 56
d.text((tx, TOP + 78), 'Mortgage Calculator ', font=title_font, fill=WHITE)
tx += d.textlength('Mortgage Calculator ', font=title_font)
d.text((tx, TOP + 78), 'Revised', font=italic_font, fill=WHITE)

d.text((M + 56, TOP + 168), 'Annuity and Linear mortgages for the Netherlands',
       font=font(34, 'Regular'), fill=WHITE)

# Feature line.
y = TOP + BH + 62
d.text((M + 8, y), 'Purchase costs  ·  NHG  ·  Tax deduction  ·  Extra repayments  ·  Rent vs. buy',
       font=font(30, 'SemiBold'), fill=BRAND500)

# Chart-colour bars, echoing the graph in the app.
by = y + 74
x = M + 8
for colour, width in zip(CHART, (150, 110, 90)):
    d.rounded_rectangle([x, by, x + width, by + 12], radius=6, fill=colour)
    x += width + 16

# Domain, bottom right.
df = font(28, 'SemiBold')
dt = 'mortgage-calculator-nl.vercel.app'
d.text((W - M - 8 - d.textlength(dt, font=df), by - 12), dt, font=df, fill=BRAND400)

img.save('public/og-image.png', 'PNG', optimize=True)
print('written')
