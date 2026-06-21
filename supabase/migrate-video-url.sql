-- Adiciona suporte a vídeo de apresentação nos itens do cardápio (YouTube, fase 1)
alter table menu_items add column if not exists video_url text;
