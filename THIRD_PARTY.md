# Upstream provenance and third-party review

Zotero ViewFlow is described by the README as a derivative of David Carter's [ZoteroPreview in dcartertod/zotero-plugins](https://github.com/dcartertod/zotero-plugins).

- Upstream repository's and this repository's license: **Apache License 2.0**, with the full license text in [LICENSE](LICENSE).
- Preserve original upstream copyright, license, file headers and any applicable NOTICE materials if present in the copied work; modified files should carry prominent modification notices as required by Apache-2.0.
- package.json lists build-time dependencies including esbuild, TypeScript and zotero-types. Confirm whether any third-party material is copied into the distributed XPI, rather than assuming development-only usage.
- Installed Zotero CSL citation styles and host APIs are not automatically redistributed by this plugin; embedded styles, locale files, fonts, icons or templates should be checked independently if included.

## Outstanding release verification
- [ ] Identify the exact copied upstream files and baseline revision; record important modifications.
- [ ] Inspect the released XPI for third-party assets and required copyright/NOTICE statements.
- [ ] Make corresponding attribution and modifications discoverable from README and release artifacts.
- [ ] Verify third-party licenses at the actual resolved dependency versions.

This file records known lineage and remaining verification steps; it is not a legal compliance certification.
