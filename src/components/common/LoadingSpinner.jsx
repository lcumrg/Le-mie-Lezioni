export default function LoadingSpinner({ message = 'Caricamento...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-edge border-t-accent rounded-full animate-spin" />
      <p className="mt-3 text-sm text-fg-muted">{message}</p>
    </div>
  )
}
