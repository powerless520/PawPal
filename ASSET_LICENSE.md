# Asset Licensing

PawPal separates source code licensing from pet animation asset licensing.

## Source Code

The application source code is licensed under the MIT License. See `LICENSE`.

## Bundled Runtime Assets

Files under `pet_assets/` are bundled runtime assets used by the app's built-in pet appearances.

These assets are not automatically covered by the MIT License unless a specific asset source explicitly grants MIT-compatible rights. Before redistributing, remixing, or using a pet asset outside this project, verify the original asset source and license.

Current built-in appearances:

- `pet_assets/金毛 puppy/`
- `pet_assets/线条小狗/`
- `pet_assets/小鸡毛/`
- `pet_assets/小恐龙/`
- `pet_assets/小锯鳄/`

### IP / Trademark Note

Some appearances may depict characters inspired by third-party intellectual property (for example, `小锯鳄` references the Pokémon Totodile, a registered trademark of Nintendo / Game Freak / The Pokémon Company). Such appearances are intended for personal, non-commercial use only. If you fork or redistribute this project:

- Do not use these appearances in any public release or commercial product without the rights holder's permission.
- Remove or replace them with original art before publishing binaries, screenshots used for promotion, or store listings.
- The MIT License covers source code only and does not grant any rights to depicted third-party characters.

## Raw Working Assets

Raw source materials live under `_raw_assets/` locally and are intentionally excluded from git.

The raw asset folder may contain generated experiments, upstream packs, original videos, intermediate exports, or other large files. Do not commit `_raw_assets/` to the public repository.

## Contributing Assets

When contributing a new pet appearance or replacing GIFs, include clear source and license information in the pull request. Prefer assets that can be redistributed with the project, and avoid adding files whose rights are unclear.
