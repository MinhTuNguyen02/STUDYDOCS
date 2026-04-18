type PackageLike = {
  turns_remaining?: number | string | null
  expires_at?: string | Date | null
  purchased_at?: string | Date | null
  packages?: {
    name?: string | null
    price?: number | string | null
  } | null
}

export interface SharedPackageSummary {
  name: string
  turnsRemaining: number
  expiresAt: string | Date | null
  price: number
}

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const toTimestamp = (value: unknown) => {
  if (!value) return 0

  const timestamp = new Date(value as string | Date).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function getSharedPackageSummary(userPackages: PackageLike[] | null | undefined): SharedPackageSummary | null {
  if (!Array.isArray(userPackages) || userPackages.length === 0) {
    return null
  }

  const now = Date.now()
  const activePackages = userPackages.filter((item) => {
    const expiresAt = toTimestamp(item?.expires_at)
    return expiresAt > now && toNumber(item?.turns_remaining) > 0
  })

  if (activePackages.length === 0) {
    return null
  }

  const currentPackage = [...activePackages].sort((a, b) => {
    const expiresA = toTimestamp(a?.expires_at)
    const expiresB = toTimestamp(b?.expires_at)
    if (expiresA !== expiresB) return expiresA - expiresB

    const purchasedA = toTimestamp(a?.purchased_at)
    const purchasedB = toTimestamp(b?.purchased_at)
    return purchasedA - purchasedB
  })[0]

  return {
    name: currentPackage?.packages?.name || 'Gói tải',
    turnsRemaining: toNumber(currentPackage?.turns_remaining),
    expiresAt: currentPackage?.expires_at ?? null,
    price: toNumber(currentPackage?.packages?.price),
  }
}
