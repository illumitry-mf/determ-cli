import { AxiosInstance } from 'axios'
import { TagsResponse, TagsCommandOptions } from '../types'
import { formatOutput } from '../formatters'

export async function fetchTags(
  client: AxiosInstance,
  orgId: string,
  options: TagsCommandOptions
): Promise<string> {
  const { data } = await client.get<TagsResponse>(`/v2/organization/${orgId}/tags`)
  return formatOutput(data, { json: options.json, fields: options.fields })
}
