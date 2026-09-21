import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { OpenAIEmbeddingClient } from '../knowledge/embeddings.ts'
import { embeddingVersion } from '../knowledge/config.ts'
import { SupabaseKnowledgeRepository } from '../knowledge/repository.ts'
import type { ProfileAiStatus } from './types.ts'
import type { AiLifecycleDependencies, AiProfileState, AiStateRepository } from './aiLifecycle.ts'
import { recordUsageSafely } from '../monetisation/usage.ts'

function client(): SupabaseClient { const url=process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('AI lifecycle requires Supabase server configuration.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}) }
const mapped=(row:Record<string,unknown>):AiProfileState=>({id:row.id as string,userId:row.user_id as string,enabled:row.ai_enabled as boolean,status:row.ai_status as ProfileAiStatus,isPublished:row.is_published as boolean})
class SupabaseAiStateRepository implements AiStateRepository{
  private readonly db:SupabaseClient;constructor(db:SupabaseClient){this.db=db}
  async findOwnedProfile(userId:string){const{data,error}=await this.db.from('profiles').select('id,user_id,is_published,ai_enabled,ai_status').eq('user_id',userId).order('created_at').limit(1).maybeSingle();if(error)throw error;return data?mapped(data):null}
  async updateState(profileId:string,userId:string,values:{enabled?:boolean;status?:ProfileAiStatus;lastIndexedAt?:string|null;lastError?:string|null}){const update:Record<string,unknown>={};if(values.enabled!==undefined)update.ai_enabled=values.enabled;if(values.status!==undefined)update.ai_status=values.status;if(values.lastIndexedAt!==undefined)update.ai_last_indexed_at=values.lastIndexedAt;if(values.lastError!==undefined)update.ai_last_error=values.lastError;const{data,error}=await this.db.from('profiles').update(update).eq('id',profileId).eq('user_id',userId).select('id,user_id,is_published,ai_enabled,ai_status').single();if(error)throw error;return mapped(data)}
}
export function createAiLifecycleDependencies():AiLifecycleDependencies{const db=client();return{state:new SupabaseAiStateRepository(db),knowledge:new SupabaseKnowledgeRepository(db),embeddings:{version:embeddingVersion(),embedTexts:inputs=>new OpenAIEmbeddingClient().embedTexts(inputs),embedText:input=>new OpenAIEmbeddingClient().embedText(input)},now:()=>new Date().toISOString(),recordEmbeddingUsage:(profile,quantity)=>recordUsageSafely(db,{userId:profile.userId,profileId:profile.id,eventType:'embedding',quantity})}}
