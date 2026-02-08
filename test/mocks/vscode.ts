/**
 * VSCode API Mock for testing
 */

export const window = {
	createOutputChannel: (name: string) => ({
		appendLine: (text: string) => console.log(text),
		show: () => { }
	}),
	showInformationMessage: (message: string) => Promise.resolve(undefined),
	showWarningMessage: (message: string) => Promise.resolve(undefined),
	showErrorMessage: (message: string) => Promise.resolve(undefined)
};

export const workspace = {
	getConfiguration: () => ({
		get: (key: string, defaultValue?: any) => defaultValue,
		update: () => Promise.resolve()
	})
};

export const commands = {
	registerCommand: () => ({ dispose: () => { } })
};

export enum ExtensionMode {
	Production = 1,
	Development = 2,
	Test = 3,
}
