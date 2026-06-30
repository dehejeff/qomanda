# Paleta de Cores Original — Backup

> Gerada em 2026-06-30. Use este arquivo para reverter se necessário.

## globals.css — `@theme inline`

```css
@theme inline {
  /* Surfaces */
  --color-background:                  #0b1326;
  --color-surface:                     #0b1326;
  --color-surface-dim:                 #0b1326;
  --color-surface-container-lowest:    #060e20;
  --color-surface-container-low:       #131b2e;
  --color-surface-container:           #171f33;
  --color-surface-container-high:      #222a3d;
  --color-surface-container-highest:   #2d3449;
  --color-surface-variant:             #2d3449;
  --color-surface-bright:              #31394d;

  /* On-surfaces */
  --color-on-background:               #dae2fd;
  --color-on-surface:                  #dae2fd;
  --color-on-surface-variant:          #e0c0b1;

  /* Primary (laranja) */
  --color-primary:                     #ffb690;
  --color-primary-container:           #f97316;
  --color-on-primary:                  #552100;
  --color-on-primary-container:        #582200;
  --color-inverse-primary:             #9d4300;

  /* Secondary (azul) */
  --color-secondary:                   #7bd0ff;
  --color-secondary-container:         #00a6e0;
  --color-on-secondary:                #00354a;
  --color-on-secondary-container:      #00374d;

  /* Tertiary */
  --color-tertiary:                    #93ccff;
  --color-tertiary-container:          #00a2f4;
  --color-on-tertiary:                 #003351;

  /* Error */
  --color-error:                       #ffb4ab;
  --color-error-container:             #93000a;
  --color-on-error:                    #690005;
  --color-on-error-container:          #ffdad6;

  /* Outline */
  --color-outline:                     #a78b7d;
  --color-outline-variant:             #584237;

  /* Misc */
  --color-inverse-surface:             #dae2fd;
  --color-inverse-on-surface:          #283044;
}
```

## globals.css — body e helpers

```css
body {
  background-color: #0b1326;
  color: #dae2fd;
}

.ghost-border { border: 1px solid #584237; }
.tonal-layer-1 { background-color: #171f33; }
.tonal-layer-2 { background-color: #2d3449; }
.glass-effect { background: rgba(23, 31, 51, 0.8); }

/* Scrollbar */
::-webkit-scrollbar-track { background: #171f33; }
::-webkit-scrollbar-thumb { background: #584237; }
::-webkit-scrollbar-thumb:hover { background: #a78b7d; }

/* Toggle */
.toggle-checkbox:checked + .toggle-label { background-color: #f97316; }
```

## page.tsx — objeto C (landing page)

```js
const C = {
  bg:        '#0b1326',
  bgCard:    '#131b2e',
  bgCard2:   '#1e293b',
  border:    'rgba(88,66,55,0.35)',
  borderBlu: 'rgba(51,65,85,0.6)',
  primary:   '#f97316',
  primaryDm: '#ffb690',
  text:      '#dae2fd',
  muted:     '#a78b7d',
  faint:     '#584237',
  green:     '#34d399',
  blue:      '#7bd0ff',
}
```

## Cores inline recorrentes (customer/waiter/components)

| Hex | Uso |
|-----|-----|
| `#0b1326` | Fundo principal |
| `#0f1e3a` | Fundo gradiente secundário |
| `#131b2e` | Card surface low |
| `#171f33` | Card surface container |
| `#f97316` | Primário (laranja) |
| `#ffb690` | Primário claro (laranja claro) |
| `#a78b7d` | Muted / outline |
| `#584237` | Faint / outline-variant |
| `#dae2fd` | Texto principal |
| `#7bd0ff` | Secundário azul |

## Como reverter

1. Copie os blocos acima de volta para `src/app/globals.css`
2. Restaure o objeto `C` em `src/app/page.tsx`
3. Nos arquivos de customer/components, substitua os novos tokens pelos antigos
