import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/customer-form";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
export default async function NewCustomerPage() {
    return (<>
      <PageHeading title="新增客户" description="在一个页面完成客户录入、旅行需求补充和规划师分配。" actions={<Button variant="outline" size="sm" asChild>
            <Link href="/customers">
              <ArrowLeft className="size-4"/>
              返回客户总池
            </Link>
          </Button>}/>
      <CustomerForm />
    </>);
}
