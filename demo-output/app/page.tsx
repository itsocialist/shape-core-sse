export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center">
          Welcome to MPCM-Pro Demo App! 🚀
        </h1>
        <p className="text-center mt-4">
          This Next.js app was created through multi-service orchestration
        </p>
        <div className="mt-8 grid text-center lg:grid-cols-2 lg:text-left">
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors">
            <h2 className="mb-3 text-2xl font-semibold">
              Multi-Service 
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Orchestrated filesystem and git operations seamlessly
            </p>
          </div>
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors">
            <h2 className="mb-3 text-2xl font-semibold">
              Workflow Engine
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Dependencies managed automatically with error handling
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
