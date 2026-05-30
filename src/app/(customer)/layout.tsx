export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: '#0b1326' }}>
      {children}
    </div>
  )
}
