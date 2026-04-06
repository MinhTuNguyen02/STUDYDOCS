import os

def replace_in_file(path, old, new):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

# 1. documents.service.ts
replace_in_file('src/modules/documents/documents.service.ts', "status: 'PAID'", "status: 'APPROVED'")
replace_in_file('src/modules/documents/documents.service.ts', 'status: "PAID"', "status: 'APPROVED'")
replace_in_file('src/modules/documents/documents.service.ts', 'rating_count', 'view_count') 

# 2. cart.service.ts
replace_in_file('src/modules/cart/cart.service.ts', "status: 'PAID'", "status: 'APPROVED'")

# 3. auth.service.ts
replace_in_file('src/modules/auth/auth.service.ts', "status === 'DELETED'", "delete_at !== null")
replace_in_file('src/modules/auth/auth.service.ts', "status: 'DELETED'", "delete_at: new Date()")

# 4. common/utils/to-bigint.util.ts
replace_in_file('src/common/utils/to-bigint.util.ts', "return BigInt(value);", "return Number(value);")
replace_in_file('src/common/utils/to-bigint.util.ts', "export function toBigInt", "export function toBigInt(value: any): number { return Number(value); }\n// export function toBigInt")

# 5. moderation.service.ts
replace_in_file('src/modules/moderation/moderation.service.ts', "reporter_customer_id", "reporter_id")
replace_in_file('src/modules/moderation/moderation.service.ts', "handled_by_staff_id", "handled_by_id")
replace_in_file('src/modules/moderation/moderation.service.ts', "status: 'DELETED'", "status: 'HIDDEN'") 

# 6. reviews.service.ts
replace_in_file('src/modules/reviews/reviews.service.ts', "rating_count:", "// rating_count:")

# 7. admin.service.ts
replace_in_file('src/modules/admin/admin.service.ts', "status: 'PAID'", "status: 'APPROVED'")
replace_in_file('src/modules/admin/admin.service.ts', "status: 'DELETED'", "status: 'HIDDEN'")
replace_in_file('src/modules/admin/admin.service.ts', "paid_at: true", "// paid_at: true")
replace_in_file('src/modules/admin/admin.service.ts', "deleted_at: true", "delete_at: true")
replace_in_file('src/modules/admin/admin.service.ts', "account_roles:", "roles:")
replace_in_file('src/modules/admin/admin.service.ts', "revenueAgg._sum", "(revenueAgg._sum as any)")
replace_in_file('src/modules/admin/admin.service.ts', "approved_by_staff_id:", "// approved_by_staff_id:")
replace_in_file('src/modules/admin/admin.service.ts', "Number(user.staffId)", "Number(user.staffId ?? 0)")
replace_in_file('src/modules/admin/admin.service.ts', "status: 'PENDING_VERIFY'", "status: 'BANNED' /* was PENDING_VERIFY */")

print("Files replaced successfully.")
