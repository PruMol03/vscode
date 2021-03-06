/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { windowOpenNoOpener } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import Severity from 'vs/base/common/severity';
import { localize } from 'vs/nls';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IOpenerService, matchesScheme } from 'vs/platform/opener/common/opener';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { BrowserLifecycleService } from 'vs/workbench/services/lifecycle/browser/lifecycleService';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';

export class BrowserWindow extends Disposable {

	constructor(
		@IOpenerService private readonly openerService: IOpenerService,
		@ILifecycleService private readonly lifecycleService: BrowserLifecycleService,
		@IDialogService private readonly dialogService: IDialogService,
		@IHostService private readonly hostService: IHostService
	) {
		super();

		this.registerListeners();
		this.create();
	}

	private registerListeners(): void {
		this._register(this.lifecycleService.onWillShutdown(() => this.onWillShutdown()));
	}

	private onWillShutdown(): void {
		// Use a timeout so that the dialog does not appear on each reload
		// that is triggered by the user itself.
		setTimeout(async () => {
			// This should normally not happen, but if for some reason
			// the workbench was shutdown while the page is still there,
			// inform the user that only a reload can bring back a working
			// state.
			const res = await this.dialogService.show(
				Severity.Error,
				localize('shutdownError', "An unexpected error occurred that requires a reload of this page."),
				[
					localize('reload', "Reload")
				],
				{
					detail: localize('shutdownErrorDetail', "The workbench was unexpectedly disposed while running.")
				}
			);

			if (res.choice === 0) {
				this.hostService.reload();
			}
		}, 1500);
	}

	private create(): void {

		// Handle open calls
		this.setupOpenHandlers();
	}

	private setupOpenHandlers(): void {

		// We need to ignore the `beforeunload` event while
		// we handle external links to open specifically for
		// the case of application protocols that e.g. invoke
		// vscode itself. We do not want to open these links
		// in a new window because that would leave a blank
		// window to the user, but using `window.location.href`
		// will trigger the `beforeunload`.
		this.openerService.setExternalOpener({
			openExternal: async (href: string) => {
				if (matchesScheme(href, Schemas.http) || matchesScheme(href, Schemas.https)) {
					windowOpenNoOpener(href);
				} else {
					this.lifecycleService.withExpectedUnload(() => window.location.href = href);
				}

				return true;
			}
		});
	}
}
