"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { PaymentReceiptRecord } from "@/lib/payment-receipt";
import { paymentMethodLabel } from "@/lib/payment-receipt";
import { orderSubtotal } from "@/lib/session-billing";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  preparing: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  ready: "bg-primary-container/20 text-primary border border-primary/20",
  delivered: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

type CustomerOrder = Order & {
  items?: Array<{
    quantity: number;
    unit_price: number;
    menu_item?: { name?: string } | null;
  }>;
  session?: { table?: { number?: string } | null } | null;
};

type PaymentRecord = PaymentReceiptRecord;

export default function CustomerPaymentDetailPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("owner_id", user.id)
      .single();

    if (!restaurant) {
      router.replace("/login");
      return;
    }

    const [customerRes, ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from("customers")
        .select("first_name, last_name")
        .eq("id", params.customerId)
        .single(),
      supabase
        .from("orders")
        .select(
          "*, items:order_items(quantity, unit_price, menu_item:menu_items(name)), session:sessions(table:tables(number))",
        )
        .eq("customer_id", params.customerId)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, amount, method, split_type, service_fee_included, confirmation_code, paid_at, created_at",
        )
        .eq("customer_id", params.customerId)
        .eq("status", "paid")
        .order("created_at", { ascending: false }),
    ]);

    if (restaurant?.name) setRestaurantName(restaurant.name);

    const c = customerRes.data;
    setCustomerName(
      c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "Cliente",
    );
    setOrders((ordersRes.data ?? []) as CustomerOrder[]);
    setPayments((paymentsRes.data ?? []) as PaymentRecord[]);
    setLoading(false);
  }, [params.customerId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPaid = useMemo(() => {
    return payments.reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const tableNumber = useMemo(() => {
    const tables = new Set(
      orders
        .map((o) => (o.session?.table as { number?: string } | null)?.number)
        .filter((n): n is string => Boolean(n)),
    );
    return tables.size === 1 ? Array.from(tables)[0] : "—";
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </div>
    );
  }

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-xs font-mono text-on-surface-variant hover:text-primary transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[16px]">
            arrow_back
          </span>
          Voltar
        </button>
        <h2
          className="text-3xl font-semibold text-on-surface"
          style={{ fontFamily: "Geist, sans-serif", letterSpacing: "-0.02em" }}
        >
          {customerName}
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Mesa {tableNumber} · {orders.length} pedido
          {orders.length !== 1 ? "s" : ""} nesta sessão
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="tonal-layer-1 ghost-border rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">
            Pedidos
          </p>
          <p className="text-2xl font-bold font-mono text-on-surface">
            {orders.length}
          </p>
          <p className="text-[10px] font-mono text-on-surface-variant mt-1">
            {orders.filter((o) => o.status === "delivered").length} entregues
          </p>
        </div>
        <div className="tonal-layer-1 ghost-border rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
            Total pago
          </p>
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-[10px] font-mono text-on-surface-variant mt-1">
            {payments.length} pagamento{payments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="tonal-layer-1 ghost-border rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">
            Última visita
          </p>
          <p className="text-2xl font-bold font-mono text-on-surface">
            {orders.length > 0
              ? new Date(orders[0].created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant">
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
              Pagamentos registrados
            </p>
          </div>
          <div className="divide-y divide-outline-variant">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-mono text-emerald-400">
                    {formatCurrency(p.amount)}
                  </p>
                  <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                    {paymentMethodLabel(p.method)}
                    {p.service_fee_included === false
                      ? " · sem taxa"
                      : " · com taxa"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {p.confirmation_code ? (
                    <p className="font-mono text-xs font-bold tracking-widest text-on-surface">
                      {p.confirmation_code}
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono text-on-surface-variant">
                      —
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                    {new Date(p.paid_at ?? p.created_at).toLocaleString(
                      "pt-BR",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
            Pedidos
          </p>
        </div>
        {orders.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm font-mono text-on-surface-variant">
            Nenhum pedido encontrado
          </p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {orders.map((order) => {
              const items = (order.items ?? [])
                .map((i) => `${i.quantity}× ${i.menu_item?.name ?? "Item"}`)
                .join(", ");
              const date = new Date(order.created_at).toLocaleDateString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                },
              );
              const time = new Date(order.created_at).toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );
              const fulfillmentBadge =
                STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;

              return (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 hover:bg-surface-container-highest transition-colors"
                >
                  <div className="sm:w-32 shrink-0">
                    <p className="text-sm font-mono text-on-surface">
                      #{order.id.slice(-4).toUpperCase()}
                    </p>
                    <p className="text-[10px] font-mono text-on-surface-variant">
                      {date} {time}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs text-on-surface-variant truncate"
                      title={items}
                    >
                      {items || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-mono text-on-surface">
                      {formatCurrency(orderSubtotal(order))}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase whitespace-nowrap ${fulfillmentBadge}`}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
