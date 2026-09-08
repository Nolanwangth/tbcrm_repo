import { PageHeading } from "@/components/page-heading";
import { SystemFeedbackBoard } from "@/components/system-feedback-board";
import { getCurrentUser } from "@/lib/auth";
import { getSystemFeedbackMessages } from "@/lib/repositories/system-feedback";
export default async function FeedbackPage() {
    const [user, messages] = await Promise.all([getCurrentUser(), getSystemFeedbackMessages()]);
    if (!user)
        return null;
    return (<>
      <PageHeading title="系统反馈" description="所有系统使用者都可以提出建议并参与回复；留言自动使用当前登录身份，且只能编辑自己发表的内容。"/>
      <SystemFeedbackBoard messages={messages} currentUserId={user.id}/>
    </>);
}
