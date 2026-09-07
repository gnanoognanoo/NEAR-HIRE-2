import {actor,handle,json,reply,service} from '../_shared/runtime.ts';
handle(async req=>{const {client,user}=await actor(req);const p=await json(req);if(p.confirmation!=='DELETE')return reply({error:'CONFIRMATION_REQUIRED'},400);const {error:limit}=await client.rpc('edge_rate_limit',{p_kind:'delete'});if(limit)throw limit;
 const db=service();const {count,error:applicationsError}=await db.from('applications').select('id',{count:'exact',head:true}).eq('worker_id',user.id).eq('status','accepted');if(applicationsError)throw applicationsError;const {count:own,error:jobsError}=await db.from('jobs').select('id',{count:'exact',head:true}).eq('poster_id',user.id).in('status',['filled','in_progress']);if(jobsError)throw jobsError;if(count||own)return reply({error:'RESOLVE_ACTIVE_WORK_FIRST'},409);
 // Bucket paths are one level only: user-id/file-name. Abort on storage errors before deleting Auth.
 for(const bucket of ['avatars','job-images','verification-documents']){while(true){const {data,error}=await db.storage.from(bucket).list(user.id,{limit:100});if(error)throw error;if(!data?.length)break;const {error:removeError}=await db.storage.from(bucket).remove(data.map(f=>`${user.id}/${f.name}`));if(removeError)throw removeError;}}
 const {error}=await db.auth.admin.deleteUser(user.id);if(error)throw error;return reply({deleted:true});
});
