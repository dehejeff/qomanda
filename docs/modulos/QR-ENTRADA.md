# QR de entrada + mapa de mesas (auto-seat / fila)

> QR único do restaurante (porta, Instagram…). O cliente escaneia → é
> identificado pelo WhatsApp (login se existe, cadastro se novo) → cai num
> **mapa de mesas** onde escolhe uma mesa livre (auto-check-in) ou entra na
> **fila de espera**. Conecta com o módulo de fila (`FILA-ESPERA.md`).

## Decisões (fechadas)
- **Auto-ocupar:** **configurável pelo restaurante** — modo **direto** (cliente
  ocupa na hora) OU **confirmação do garçom**.
- **Mapa:** mostra **livres + ocupadas/reservadas + fila** (todas as mesas com
  suas características; livres clicáveis, ocupadas em cinza; mesa ocupada com
  tag → entrar na fila por aquela característica).
- **Identificação:** reaproveita o fluxo WhatsApp + PIN (login/cadastro).

## 1. Configuração (admin)
- `restaurants.self_seat_requires_host boolean default false` (direto vs
  confirmação). Toggle em Settings.
- **QR de entrada:** QR único por restaurante → `/{slug}/entrada` (sem token de
  mesa; segurança via WhatsApp). Botão "QR de entrada" na tela de Mesas
  (generalizar `CounterQrModal` num componente de QR reutilizável).

## 2. `/{slug}/entrada` (cliente)
- Identifica pelo WhatsApp (login + PIN, ou cadastro novo nome/WhatsApp/PIN/CPF
  opcional — igual ao balcão, porém sem mesa). Depois → mapa de mesas.
- Restaurante **counter-only**: `/entrada` encaminha para o balcão (sem mapa).

## 3. `/{slug}/mesas` (mapa do cliente)
- Todas as mesas não arquivadas: livres clicáveis, ocupadas/reservadas em cinza,
  com as características (tags).
- Mesa livre → auto-seat (conforme o modo).
- Mesa ocupada com tag (ou botão) → entra na fila por aquela característica.

## 4. Auto-seat `/api/checkin/self`
- POST `{ slug, tableId, customerId }`:
  - valida mesa livre + do restaurante + não arquivada.
  - **direto:** claim ATÔMICO da mesa (update `free → occupied` condicional —
    quem chega primeiro ganha), cria sessão + participante + visita → `sessionId`.
  - **confirmação:** cria solicitação (notifica garçom) → responde "pendente".

## 5. Modo confirmação do garçom (Fase 2 — mais pesado)
- `seat_requests` (ou tipo `seat_request` em `restaurant_notifications`):
  `restaurant_id, table_id, customer_id, status (pending/confirmed/declined)`.
- Garçom vê (realtime, estilo "Chamar Garçom") e confirma (abre sessão) ou
  recusa; o cliente sai do "aguardando" para o cardápio.

## 6. Pontos de atenção
- **Concorrência:** claim atômico da mesa no modo direto.
- **Abuso:** exige WhatsApp identificado antes de ocupar; restaurante com
  necessidade de controle usa o modo confirmação.
- **Reaproveitar:** identificação WhatsApp, geração de QR, fila de espera,
  check-in/sessão existentes.

## 7. Fases
1. **Config + QR de entrada + `/entrada` + mapa + auto-seat DIRETO + link p/ fila.**
2. **Modo confirmação do garçom** (seat_requests + tela/ação do garçom + estado
   "aguardando" no cliente).

## 8. Arquivos
- Migração: `self_seat_requires_host` (+ `seat_requests` na Fase 2).
- Admin: toggle em Settings + botão "QR de entrada" na Mesas (QR genérico).
- Cliente: `/{slug}/entrada`, `/{slug}/mesas`.
- Endpoint: `/api/checkin/self` (+ seat-requests na Fase 2).
- Garçom (Fase 2): solicitações de mesa.
