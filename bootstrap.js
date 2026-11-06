var Zotero;
var startupGeneration = 0;
var activeRootURI = null;
async function startup({ id, version, rootURI }) {
	const generation = ++startupGeneration;
	await Zotero.initializationPromise;
	if (generation !== startupGeneration) return;
	try {
		activeRootURI = rootURI;
		Services.scriptloader.loadSubScript(rootURI + 'zoteropreview.js');
		const preview = Zotero.zoteropreview;
		preview.init({ id, version, rootURI });
		if (Zotero.ftl?.addResourceIds) {
			Zotero.ftl.addResourceIds(['zotero-preview.ftl']);
			preview._ftlRegistered = true;
		}
		Zotero.PreferencePanes.register({
			pluginID: id,
			src: rootURI + 'prefs.xhtml',
			scripts: [rootURI + 'zoteropreview_prefs.js'],
			stylesheets: [rootURI + 'settings.css'],
			defaultXUL: true
		});
		preview.start();
	}
	catch (error) { shutdown(); throw error; }
}
function shutdown(_data, reason) {
	startupGeneration++;
	const preview = Zotero?.zoteropreview;
	try { preview?.shutdown(); }
	catch (error) { Zotero.logError?.(error); }
	finally {
		try {
			if (preview?._ftlRegistered) Zotero.ftl?.removeResourceIds?.(['zotero-preview.ftl']);
		}
		catch (error) { Zotero.logError?.(error); }
		finally {
			if (Zotero) delete Zotero.zoteropreview;
			const appShutdown = typeof APP_SHUTDOWN !== 'undefined' && reason === APP_SHUTDOWN;
			if (!appShutdown) {
				try { if (activeRootURI && typeof Cu !== 'undefined') Cu.unload(activeRootURI + 'zoteropreview.js'); }
				catch (error) { Zotero?.logError?.(error); }
				try {
					if (typeof Cc !== 'undefined' && typeof Ci !== 'undefined') {
						Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService).flushBundles();
					}
				} catch (error) { Zotero?.logError?.(error); }
				try {
					if (typeof ADDON_DISABLE !== 'undefined' && reason === ADDON_DISABLE) Services.obs.notifyObservers(null, 'startupcache-invalidate', null);
				} catch (error) { Zotero?.logError?.(error); }
			}
			activeRootURI = null;
		}
	}
}
function install() {}
function uninstall() {}
