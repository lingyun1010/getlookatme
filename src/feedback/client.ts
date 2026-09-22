import { requireSupabase } from '../auth/supabase.ts'

export type FeedbackCategory = 'bug' | 'feedback' | 'idea'

export async function submitBetaFeedback(input: {
  userId: string
  profileId?: string
  category: FeedbackCategory
  message: string
}): Promise<void> {
  const message = input.message.trim()
  if (!message) throw new Error('Tell us what happened or what you would like to see.')
  if (message.length > 4000) throw new Error('Feedback must be 4,000 characters or fewer.')
  const { error } = await requireSupabase().from('beta_feedback').insert({
    user_id: input.userId,
    profile_id: input.profileId ?? null,
    category: input.category,
    message,
  })
  if (error) throw new Error('Feedback could not be sent. Your dashboard is still available—please try again later.')
}
