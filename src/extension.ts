import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as jsonFile from 'jsonfile'

const set = require('lodash/set')

export function activate(context: vscode.ExtensionContext) {
  let translationManager = new TranslationManager();

  let disposable = vscode.commands.registerCommand(
    'translationManager.addLocalizedMessage',
    translationManager.addLocalizedMessage
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(translationManager);
}

export function deactivate() {
}

class TranslationManager {
  public async addLocalizedMessage() {
    let localeFolder = await TranslationManager.getLocaleFolder();
    if (!localeFolder) {
      return;
    }
    const locales = await TranslationManager.getLocales(localeFolder);

    let editor = vscode.window.activeTextEditor;
    let id = (!editor) ? undefined : editor.document.getText(editor.selection);
    id = await vscode.window.showInputBox({ prompt: 'Enter the message identifier', value: id });
    if (!id) {
      return;
    }

    for (let locale of locales) {
      let translation = await vscode.window.showInputBox({
        prompt: `Enter the localized message for the locale '${locale}'`
      });
      if (translation !== undefined) {
        try {
          await TranslationManager.persistTranslation(localeFolder, locale, id, translation);
          vscode.window.setStatusBarMessage(`Successfully stored the '${locale}' translation of '${id}'.`, 4000);
        } catch (e) {
          vscode.window.showErrorMessage('Storing the translation failed: ' + e);
        }
      }
    }
  }

  private static async persistTranslation(localeFolder: string, locale: string, id: string, translation: string) {
    return new Promise((resolve, reject) => {
      let localeFile = path.join(localeFolder, locale + '.json');
      jsonFile.readFile(localeFile, (_e, obj) => {
        obj = obj || {};
        set(obj, id, translation);
        jsonFile.writeFile(localeFile, obj, { spaces: 2 }, (err) => reject(err));
        resolve();
      })
    })
  }

  private static async getLocaleFolder() {
    let localeFolder = vscode.workspace.getConfiguration('translationManager').get<string>('localeFolder');
    if (!localeFolder || (await TranslationManager.getLocales(localeFolder)).length === 0) {
      if(!await vscode.window.showInformationMessage('Please select your locale folder', 'Browse')) {
        return;
      }

      const dialogOptions: vscode.OpenDialogOptions = {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Open',
        defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
          ? vscode.workspace.workspaceFolders[0].uri
          : undefined
      };

      let fileUri = await vscode.window.showOpenDialog(dialogOptions);
      if (fileUri && fileUri[0]) {
        localeFolder = vscode.workspace.asRelativePath(fileUri[0]);
        const configTarget = !vscode.workspace.workspaceFolders;
        await vscode.workspace
            .getConfiguration('translationManager')
            .update('localeFolder', localeFolder, configTarget);
        return localeFolder;
      }

      vscode.window.showErrorMessage(
        'Translation Manager doesn\'t work without a valid locale folder.');
    }
    return localeFolder;
  }

  private static async getLocales(localeFolder: string) {
    if (path.isAbsolute(localeFolder)) {
      let files = fs.readdirSync(localeFolder);
      return files
        .filter((file) => file.length > 5 && file.endsWith('.json'))
        .map((file) => file.substring(0, file.length - '.json'.length));
    }

    return vscode.workspace.findFiles(localeFolder + '/*.json').then(
      (files) => {
        return files.map((fileUri) => fileUri.toString());
      },
      (reason) => {
        vscode.window.showErrorMessage(reason);
        return [];
      }
    );
  }

  public dispose() {}
}
