import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { Array as Arr, Cause, Console, Effect, Layer, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { createLinter, loadLinterFormatter, loadTextlintrc } from "textlint";

const MARKDOWN_FILES = ["**/*.md"];
const ERROR_SEVERITY = 2;
const EXIT_SUCCESS = 0;

const SkillList = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ name: Schema.String, path: Schema.String })),
);

const run = Effect.fn("run")(function* run(command: string, args: readonly string[]) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(ChildProcess.make(command, args));
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" },
  );
  return { succeeded: exitCode === EXIT_SUCCESS, stdout, output: `${stdout}${stderr}` };
}, Effect.scoped);

const textlint = Effect.gen(function* textlint() {
  const descriptor = yield* Effect.promise(() => loadTextlintrc());
  const results = yield* Effect.promise(() =>
    createLinter({ descriptor, ignoreFilePath: ".textlintignore" }).lintFiles(MARKDOWN_FILES),
  );
  const formatter = yield* Effect.promise(() => loadLinterFormatter({ formatterName: "stylish" }));
  yield* Console.log(formatter.format(results));
  return {
    files: results.map((result) => result.filePath),
    succeeded: !results.some((result) =>
      result.messages.some((message) => message.severity === ERROR_SEVERITY),
    ),
  };
});

const yomiyasuScript = Effect.gen(function* yomiyasuScript() {
  const path = yield* Path.Path;
  const listed = yield* run("skills", ["ls", "--json"]);
  const skills = yield* Schema.decodeEffect(SkillList)(listed.stdout);
  const skill = yield* Effect.fromOption(Arr.findFirst(skills, ({ name }) => name === "yomiyasu"));
  return path.join(skill.path, "scripts", "yomiyasu_lint.py");
});

const yomiyasu = Effect.fn("yomiyasu")(function* yomiyasu(files: readonly string[]) {
  const script = yield* yomiyasuScript;
  const runs = yield* Effect.forEach(files, (file) => run("python3", [script, "--strict", file]), {
    concurrency: "unbounded",
  });
  yield* Console.log(runs.map((result) => result.output).join("\n"));
  return runs.every((result) => result.succeeded);
});

const markdownLint = Effect.gen(function* markdownLint() {
  const linted = yield* textlint;
  const proofread = yield* yomiyasu(linted.files);
  if (!linted.succeeded || !proofread) {
    return yield* Effect.fail("Markdown の検査が失敗した");
  }
  return linted.files;
});

runMain(
  Layer.build(nodeServicesLayer).pipe(
    Effect.flatMap((context) =>
      markdownLint.pipe(
        Effect.tapCause((cause) => Console.error(Cause.pretty(cause))),
        Effect.provideContext(context),
      ),
    ),
    Effect.scoped,
  ),
  { disableErrorReporting: true },
);
