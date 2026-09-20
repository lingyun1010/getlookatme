import assert from 'node:assert/strict'
import test from 'node:test'
import { lingyunProfile } from '../src/profile/profiles/lingyun.ts'
import { checkSlugAvailability, PublicationError, publishProfile, unpublishProfile, updateProfileSlug, type PublicationProfile, type PublicationRepository } from '../src/profile/publication.ts'
import { normalizeProfileSlug, validateProfileSlug } from '../src/profile/slugs.ts'
import type { ProfileDocument } from '../src/profile/types.ts'

const profileId='11111111-1111-4111-8111-111111111111',ownerId='owner-a'
class FakeRepository implements PublicationRepository {
  profiles: PublicationProfile[]=[{id:profileId,userId:ownerId,slug:'profile-old',document:structuredClone({...lingyunProfile,profileId,slug:'profile-old'}),isPublished:false}]
  updates:Array<{profileId:string;userId:string;values:Record<string,unknown>}>=[]
  async findOwnedProfile(userId:string){return structuredClone(this.profiles.find(profile=>profile.userId===userId)??null)}
  async findProfileIdBySlug(slug:string){return this.profiles.find(profile=>profile.slug===slug)?.id??null}
  async updateProfile(id:string,userId:string,values:{slug?:string;document?:ProfileDocument;isPublished?:boolean}){
    const profile=this.profiles.find(item=>item.id===id&&item.userId===userId)
    if(!profile)throw new Error('not owned')
    if(values.slug&&this.profiles.some(item=>item.id!==id&&item.slug===values.slug))throw Object.assign(new Error('duplicate'),{code:'23505'})
    Object.assign(profile,values.slug!==undefined?{slug:values.slug}:{},values.document!==undefined?{document:values.document}:{},values.isPublished!==undefined?{isPublished:values.isPublished}:{})
    this.updates.push({profileId:id,userId,values});return structuredClone(profile)
  }
}

test('normalizes valid custom slugs and rejects invalid, empty, and reserved routes',()=>{
  assert.equal(normalizeProfileSlug('  AI Engineer  Lingyun--Zhao '),'ai-engineer-lingyun-zhao')
  assert.deepEqual(validateProfileSlug('lingyun-zhao'),{valid:true,slug:'lingyun-zhao'})
  for(const slug of ['', '-invalid', 'invalid-', 'bad_slug', 'dashboard', 'preview', 'api', 'lingyun']) assert.equal(validateProfileSlug(slug).valid,false,slug)
})

test('availability rejects another profile while allowing the owner current slug',async()=>{
  const repository=new FakeRepository();repository.profiles.push({id:'other',userId:'owner-b',slug:'taken-slug',document:{},isPublished:false})
  assert.equal((await checkSlugAvailability(ownerId,'profile-old',repository)).available,true)
  await assert.rejects(checkSlugAvailability(ownerId,'taken slug',repository),(error:unknown)=>error instanceof PublicationError&&error.code==='unavailable')
})

test('owner changes slug in place and keeps row and document identity consistent',async()=>{
  const repository=new FakeRepository(),before=structuredClone(repository.profiles[0])
  const updated=await updateProfileSlug(ownerId,'New Public URL',repository)
  assert.equal(updated.id,before.id);assert.equal(updated.userId,before.userId);assert.equal(updated.slug,'new-public-url')
  assert.equal((updated.document as typeof lingyunProfile).slug,'new-public-url');assert.equal((updated.document as typeof lingyunProfile).profileId,profileId)
  assert.equal(await repository.findProfileIdBySlug('profile-old'),null);assert.equal(await repository.findProfileIdBySlug('new-public-url'),profileId)
})

test('owner publishes and unpublishes without knowledge or AI readiness dependencies',async()=>{
  const repository=new FakeRepository();(repository.profiles[0].document as ProfileDocument).ai.enabled=false
  const published=await publishProfile(ownerId,'public profile',repository);assert.equal(published.isPublished,true);assert.equal(published.slug,'public-profile')
  const snapshot=structuredClone(published.document);const unpublished=await unpublishProfile(ownerId,repository)
  assert.equal(unpublished.isPublished,false);assert.equal(unpublished.slug,'public-profile');assert.deepEqual(unpublished.document,snapshot)
})

test('anonymous or non-owner identity cannot mutate another profile',async()=>{
  const repository=new FakeRepository()
  for(const userId of ['', 'owner-b']){
    await assert.rejects(publishProfile(userId,'valid-slug',repository),error=>error instanceof PublicationError&&error.code==='not_found')
    await assert.rejects(unpublishProfile(userId,repository),error=>error instanceof PublicationError&&error.code==='not_found')
    await assert.rejects(updateProfileSlug(userId,'valid-slug',repository),error=>error instanceof PublicationError&&error.code==='not_found')
  }
  assert.equal(repository.updates.length,0)
})

test('publication uses existing database uniqueness and does not reference RAG readiness',async()=>{
  const {readFile}=await import('node:fs/promises')
  const [migration,service,production,local]=await Promise.all([
    readFile(new URL('../supabase/migrations/20260918021022_auth_profile_ownership.sql',import.meta.url),'utf8'),
    readFile(new URL('../src/profile/publication.ts',import.meta.url),'utf8'),readFile(new URL('../api/profile-publication.ts',import.meta.url),'utf8'),readFile(new URL('../scripts/dev-api.ts',import.meta.url),'utf8'),
  ])
  assert.match(migration,/slug text not null unique/i);assert.doesNotMatch(service,/knowledge|embedding|rag/i)
  assert.match(production,/handlePublicationRequest/);assert.match(local,/handlePublicationRequest/)
})
