import type { Customer, ServiceWorkbench } from "@/lib/types";
export function serviceWorkbenchCustomers(customers: Customer[], workbench: ServiceWorkbench) {
    return customers.filter((customer) => customer.status === "跟进中" && customer.serviceWorkbench === workbench);
}
