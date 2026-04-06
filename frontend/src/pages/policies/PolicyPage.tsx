import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { documentsApi } from '@/api/documents.api'
import { formatDate } from '@/utils/format'

export default function PolicyPage() {
  const { slug } = useParams()
  const [policy, setPolicy] = useState<any>(null)
  const [allPolicies, setAllPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPolicy = async () => {
      setLoading(true)
      try {
        const listRes = await documentsApi.getPolicies()
        setAllPolicies(listRes || [])
        
        if (slug) {
          const detailRes = await documentsApi.getPolicyBySlug(slug)
          setPolicy(detailRes || null)
        } else if (listRes && listRes.length > 0) {
          // If no slug provided, but policies exist, default to first policy
          const firstSlug = listRes[0].slug
          const detailRes = await documentsApi.getPolicyBySlug(firstSlug)
          setPolicy(detailRes || null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPolicy()
  }, [slug])

  if (loading) return <div style={{ padding: '60px', textAlign: 'center' }}>Đang tải...</div>

  if (!policy) return <div style={{ padding: '60px', textAlign: 'center' }}>Không tìm thấy chính sách.</div>

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2xl)' }}>
      {/* ── Sidebar (List of policies) ── */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Điều khoản & Chính sách</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {allPolicies.map(p => (
              <li key={p.policy_id || p.id}>
                <Link 
                  to={`/policies/${p.slug}`}
                  style={{
                    display: 'block',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: policy.slug === p.slug ? 'var(--bg-tertiary)' : 'transparent',
                    color: policy.slug === p.slug ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: policy.slug === p.slug ? 600 : 400
                  }}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, background: 'var(--bg-primary)', padding: 'var(--space-2xl)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-sm)' }}>{policy.title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xl)' }}>
          Cập nhật lần cuối: {formatDate(policy.updated_at || policy.updatedAt || policy.created_at)}
        </p>

        {/* Content rendering: Assuming it's HTML from WYSIWYG editor */}
        <div 
          style={{ lineHeight: 1.8, fontSize: 'var(--text-base)' }}
          dangerouslySetInnerHTML={{ __html: policy.content }} 
        />
      </div>
    </div>
  )
}
