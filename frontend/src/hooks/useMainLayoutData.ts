import { useCallback, useEffect, useState } from "react";
import { documentsApi } from "@/api/documents.api";
import { walletsApi } from "@/api/wallets.api";
import { asCollection } from "@/api/request";
import type { AuthUser } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useNotificationStore } from "@/store/notificationStore";

export interface FooterCategory {
  id?: number;
  category_id?: number;
  name: string;
}

export interface FooterPolicy {
  id?: number;
  policy_id?: number;
  slug: string;
  title: string;
}

export interface LayoutWallet {
  balance: number | string;
  wallet_type?: string;
  walletType?: string;
}

export function useMainLayoutData(user: AuthUser | null, isStaff: boolean) {
  const fetchCart = useCartStore((state) => state.fetchCart);
  const socket = useNotificationStore((state) => state.socket);
  const [footerCategories, setFooterCategories] = useState<FooterCategory[]>([]);
  const [footerPolicies, setFooterPolicies] = useState<FooterPolicy[]>([]);
  const [wallets, setWallets] = useState<LayoutWallet[]>([]);

  useEffect(() => {
    if (user) void fetchCart();
  }, [fetchCart, user]);

  useEffect(() => {
    void Promise.all([documentsApi.getCategories(), documentsApi.getPolicies()])
      .then(([categories, policies]) => {
        setFooterCategories(asCollection<FooterCategory>(categories));
        setFooterPolicies(asCollection<FooterPolicy>(policies));
      })
      .catch(() => {
        setFooterCategories([]);
        setFooterPolicies([]);
      });
  }, []);

  const loadWallets = useCallback(async () => {
    if (!user || isStaff) return [];
    try {
      return asCollection<LayoutWallet>(await walletsApi.getMyWallets());
    } catch {
      return [];
    }
  }, [isStaff, user]);

  useEffect(() => {
    let active = true;
    void loadWallets().then((nextWallets) => {
      if (active) setWallets(nextWallets);
    });
    return () => {
      active = false;
    };
  }, [loadWallets]);

  useEffect(() => {
    if (!socket) return;
    const refreshWallets = () => {
      void loadWallets().then(setWallets);
    };
    socket.on("wallet_updated", refreshWallets);
    return () => {
      socket.off("wallet_updated", refreshWallets);
    };
  }, [loadWallets, socket]);

  return { footerCategories, footerPolicies, wallets };
}
