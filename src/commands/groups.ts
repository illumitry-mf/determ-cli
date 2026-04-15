import { AxiosInstance } from 'axios'
import { V1GroupsResponse, Group, GroupsCommandOptions } from '../types'
import { formatOutput } from '../formatters'

export async function fetchGroups(
  client: AxiosInstance,
  orgId: string,
  options: GroupsCommandOptions
): Promise<string> {
  // Uses v1 API — no v2 equivalent exists for listing groups/topics
  const { data } = await client.get<V1GroupsResponse>(`/organizations/${orgId}/groups`)

  const groups: Group[] = data.data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    topics: g.keywords.map((kw) => ({
      id: kw.id,
      name: kw.name,
      active: kw.active,
    })),
  }))

  return formatOutput({ groups }, { json: options.json, fields: options.fields })
}
