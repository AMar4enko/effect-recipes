import { FileSystem } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Duration, Effect, Layer, Logger, LogLevel, Ref, Stream } from 'effect'

const watcher = Layer.scopedDiscard(Effect.gen(function* () {
  const busy = yield* Ref.make(false)

  const build = Effect.acquireUseRelease(
    busy.modify(() => [true, true]),
    (a) => Effect.gen(function* () {
      yield* Effect.logInfo(`Building...`)
      yield* Effect.tryPromise(() => 
        Bun.build({
          entrypoints: ['./infra/index.ts'],
          outdir: './out',
          minify: true,
          target: 'node',
          format: `cjs`,
          packages: 'external'        
        })
      )
      yield* Effect.logInfo(`Done`)
    })
      ,
    () => busy.modify(() => [false, false])
  )

  yield* FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.watch(`./infra`).pipe(
      Stream.dropWhileEffect(() => busy),
      Stream.debounce(Duration.millis(300)),
      Stream.tap(() => build),
      Stream.runDrain
    )))
}))
  
watcher.pipe(
  Layer.launch,
  Effect.provide(BunContext.layer),
  Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
  BunRuntime.runMain
)
