import { StorefrontShell } from "@/components/store/shell";
import { Checkout } from "@/components/store/checkout";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <StorefrontShell>
      <Checkout />
    </StorefrontShell>
  );
}
