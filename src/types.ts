// Credentials
export interface DetermConfig {
  accessToken: string
  orgId: string
}

export interface ConfigOptions {
  token?: string
  org?: string
}

// API filter primitives
export type SortProperty = 'PUBLISHED_TIME' | 'FEED_TIME' | 'REACH' | 'VIRALITY'
export type SortDirection = 'ASC' | 'DESC'
export type MentionType =
  | 'WEB' | 'TWITTER' | 'INSTAGRAM' | 'REDDIT' | 'YOUTUBE'
  | 'FACEBOOK' | 'FORUM' | 'COMMENT' | 'DISQUS' | 'TRIPADVISOR' | 'VKONTAKTE'
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNDEFINED'

export interface FilterClause<T> {
  any?: T[]
  all?: T[]
  not?: T[]
}

export interface DateInterval {
  from: number
  to: number
}

// Request shapes
export interface MentionFilter {
  mentionType?: FilterClause<MentionType>
  sentiment?: FilterClause<Sentiment>
  tag?: FilterClause<number>
  language?: FilterClause<string>
  location?: FilterClause<string>
  author?: FilterClause<string>
}

export interface MentionsQuery {
  mentionFilter?: MentionFilter
  feedTime?: DateInterval
  publishedTime?: DateInterval
}

export interface PagedRequest {
  count: number
  sorted: {
    direction: SortDirection
    property: SortProperty
  }
}

export interface MentionsRequest {
  query: MentionsQuery
  paged: PagedRequest
  scrollToken?: string
  includeFullText?: boolean
}

// Response shapes
export interface Mention {
  id: number
  type: string
  mention: string
  fullText?: string
  languages: string[]
  from: string
  author: string
  influencer?: string
  insertTime: number
  title: string
  url: string
  mentionUrl?: string
  image?: string
  photo?: string
  originalPhoto?: string
  thumbnail?: string
  photos?: string[]
  originalPhotos?: string[]
  thumbnails?: string[]
  reach?: number
  virality?: number
  databaseInsertTime?: number
  keywords: string[]
  locations: string[]
  autoSentiment?: string
  sourceReach?: number
  interaction?: number
  influenceScore?: number
  followersCount?: number
  domain?: string
  likeCount?: number
  commentCount?: number
  shareCount?: number
  description?: string
  score?: number
  tagFeedLocations: unknown[]
  keywordId?: number
  keywordName?: string
  groupId?: number
  groupName?: string
  keywordNames?: string[]
  // Twitter-specific
  twitterProfileId?: string
  favoriteCount?: number
  retweetCount?: number
  replyCount?: number
  quoteCount?: number
  twitterHandle?: string
  fullMention?: string
  tweetType?: string
  tweetSourceName?: string
  tweetSourceUrl?: string
  mediaType?: string
  engagementRate?: number
  prValue?: number
  // Reddit-specific
  subreddit?: string
  redditType?: string
  redditFullname?: string
  redditScore?: number
  redditCommentId?: string
  redditParentLinkId?: string
  // Other
  authorGender?: string
}

export interface MentionsResponse {
  mentions: Mention[]
  scrollToken?: string
}

export interface Tag {
  id: number
  name: string
  categoryId: number
}

export interface TagsResponse {
  tags: Tag[]
}

// Formatter options
export interface FormatOptions {
  json?: boolean
  fields?: string[]
}

// Command options
export interface MentionsOptions {
  keyword?: string
  group?: string
  from?: string
  to?: string
  sentiment?: string
  type?: string
  tag?: string
  count?: number
  all?: boolean
  fields?: string[]
  sortBy?: string
  sortDir?: string
  useFeedTime?: boolean
  fullText?: boolean
  json?: boolean
}

export interface TagsCommandOptions {
  json?: boolean
  fields?: string[]
}

// v1 Groups API (used for discovery — no v2 equivalent exists)
export interface V1Topic {
  id: number
  name: string
  group_id: number
  active: boolean
  color?: string
}

export interface V1Group {
  id: number
  name: string
  color?: string
  keywords: V1Topic[]
}

export interface V1GroupsResponse {
  message: string
  data: {
    groups: V1Group[]
  }
}

// Normalised shapes for output
export interface Topic {
  id: number
  name: string
  active: boolean
}

export interface Group {
  id: number
  name: string
  topics: Topic[]
}

export interface GroupsCommandOptions {
  json?: boolean
  fields?: string[]
}

// v1 Update Mention
export interface MentionRef {
  mention_id: number
  source_type: string
}

export interface UpdateMentionRequest {
  selected_mention_ids: MentionRef[]
  tag_id?: number
  category_id?: number
  irrelevant?: boolean
  sentiment?: 'positive' | 'negative' | 'neutral'
  keyword_id?: number
}

export interface UpdateMentionResponse {
  code: number
  message: string
  data: {
    message_code: string
    message_transformed: string
  }
}

export interface UpdateMentionOptions {
  group: string
  mentions: string     // "mentionId:sourceType,..." comma-separated pairs
  tagId?: string
  categoryId?: string
  irrelevant?: boolean
  sentiment?: string
  keyword?: string
  json?: boolean
}
