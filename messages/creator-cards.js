module.exports = {
  CREATED: 'Creator Card Created Successfully.',
  RETRIEVED: 'Creator Card Retrieved Successfully.',
  DELETED: 'Creator Card Deleted Successfully.',

  // Business rule error messages
  SLUG_TAKEN: 'Slug is already taken',
  SLUG_INVALID: 'slug may only contain letters, numbers, hyphens and underscores',
  ACCESS_CODE_REQUIRED: 'access_code is required when access_type is private',
  ACCESS_CODE_NOT_ALLOWED: 'access_code can only be set on private cards',
  ACCESS_CODE_INVALID_FORMAT: 'access_code must be exactly 6 alphanumeric characters',
  CARD_NOT_FOUND: 'Creator card not found',
  CARD_IS_DRAFT: 'Creator card not found',
  ACCESS_CODE_MISSING: 'This card is private. An access code is required',
  ACCESS_CODE_INVALID: 'Invalid access code',
};
