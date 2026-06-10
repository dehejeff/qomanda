import type { TableFeature } from '@/app/api/dashboard/table-features/route'
import type { RestaurantTable } from '@/types'
import { sortTablesByNumber } from '@/lib/sort-tables'

export type TableSection = {
  id: string
  name: string
  emoji: string | null
  tables: RestaurantTable[]
}

const UNASSIGNED_ID = '__unassigned__'

type Assignment = { table_id: string; feature_id: string }

/** Agrupa mesas por seção (característica). Mesa com várias tags entra só na primeira (ordem de criação). */
export function groupTablesBySection(
  tables: RestaurantTable[],
  features: TableFeature[],
  assignments: Assignment[],
): TableSection[] {
  if (features.length === 0) {
    return tables.length > 0
      ? [{ id: UNASSIGNED_ID, name: 'Salão', emoji: null, tables: sortTablesByNumber(tables) }]
      : []
  }

  const featureOrder = new Map(features.map((f, i) => [f.id, i]))
  const tableFeatureIds = new Map<string, string[]>()
  for (const a of assignments) {
    const list = tableFeatureIds.get(a.table_id) ?? []
    list.push(a.feature_id)
    tableFeatureIds.set(a.table_id, list)
  }

  const buckets = new Map<string, RestaurantTable[]>()
  for (const f of features) buckets.set(f.id, [])
  buckets.set(UNASSIGNED_ID, [])

  for (const table of tables) {
    const fids = (tableFeatureIds.get(table.id) ?? [])
      .filter((id) => featureOrder.has(id))
      .sort((a, b) => featureOrder.get(a)! - featureOrder.get(b)!)

    const bucketId = fids.length > 0 ? fids[0] : UNASSIGNED_ID
    buckets.get(bucketId)!.push(table)
  }

  const sections: TableSection[] = []
  for (const f of features) {
    const sorted = sortTablesByNumber(buckets.get(f.id) ?? [])
    if (sorted.length > 0) {
      sections.push({ id: f.id, name: f.name, emoji: f.emoji, tables: sorted })
    }
  }

  const unassigned = sortTablesByNumber(buckets.get(UNASSIGNED_ID) ?? [])
  if (unassigned.length > 0) {
    sections.push({
      id: UNASSIGNED_ID,
      name: 'Sem seção',
      emoji: null,
      tables: unassigned,
    })
  }

  return sections
}

/** Exibe cabeçalhos de seção só quando há seções cadastradas. */
export function shouldShowSectionHeaders(features: TableFeature[]): boolean {
  return features.length > 0
}
