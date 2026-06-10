export type MateriaisBlock =
  | { type: 'text'; title?: string; body: string; copyable?: boolean }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'table'; title?: string; headers: string[]; rows: string[][] }
  | { type: 'checklist'; title?: string; storageKey: string; items: { id: string; label: string; hint?: string }[] }
  | { type: 'link'; title?: string; href: string; label: string; desc?: string }

export type MateriaisSection = {
  id: string
  title: string
  intro?: string
  blocks: MateriaisBlock[]
}

export type MateriaisPageContent = {
  slug: string
  title: string
  subtitle: string
  related: { href: string; label: string }[]
  sections: MateriaisSection[]
}
