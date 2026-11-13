-- Website icon for hide-unusable-expressions, the renamed hide-unusable-emojis; an icon a maintainer already picked is kept.
UPDATE "addon" SET "icon" = 'IconFaceMinus'
WHERE "id" = 'unbound.hide-unusable-expressions' AND "icon" IS NULL;
