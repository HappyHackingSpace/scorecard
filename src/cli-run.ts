import { main } from "./cli";

main().then((code) => {
	process.exitCode = code;
});
