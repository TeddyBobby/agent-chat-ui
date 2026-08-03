export default function ChatLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      {/* Sidebar skeleton */}
      <aside className="h-full w-[284px] flex-shrink-0 bg-[#f5f5f5] dark:bg-zinc-900" />

      {/* Main area skeleton */}
      <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        {/* Header spacer */}
        <div className="h-16 flex-shrink-0 border-b border-gray-100 dark:border-zinc-800/50" />

        {/* Message area — centered welcome skeleton */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm w-full">
            {/* Logo placeholder */}
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-200 to-purple-200 dark:from-indigo-500/20 dark:to-purple-500/20 animate-pulse" />

            {/* Title skeleton */}
            <div className="h-6 w-24 mx-auto mb-3 rounded-md bg-gray-100 dark:bg-zinc-800 animate-pulse" />

            {/* Subtitle skeleton */}
            <div className="space-y-2">
              <div className="h-3 w-48 mx-auto rounded bg-gray-50 dark:bg-zinc-800/50 animate-pulse" />
              <div className="h-3 w-36 mx-auto rounded bg-gray-50 dark:bg-zinc-800/50 animate-pulse" />
            </div>

            {/* Quick-start cards skeleton */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
                  <div className="space-y-1.5 w-full">
                    <div className="h-3 w-16 mx-auto rounded bg-gray-50 dark:bg-zinc-800/50 animate-pulse" />
                    <div className="h-2.5 w-20 mx-auto rounded bg-gray-50 dark:bg-zinc-800/50 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Composer bar skeleton */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800/50 p-4">
          <div className="mx-auto max-w-2xl">
            <div className="h-10 w-full rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-pulse" />
          </div>
        </div>
      </main>

      {/* Task panel skeleton (collapsed state) */}
      <aside className="h-full w-0 flex-shrink-0" />
    </div>
  );
}
