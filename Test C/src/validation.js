const { DEFAULT_CLUB_IMAGE, FILTER_OPTIONS } = require("./constants");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const LOCAL_IMAGE_PATTERN = /^\/images\/[a-z0-9-]+\.svg$/i;

function cleanText(value, maxLength, { multiline = false } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = multiline
    ? value.replace(/\r/g, "").trim()
    : value.replace(/\s+/g, " ").trim();

  return normalized.slice(0, maxLength);
}

function isAllowedOption(value, options) {
  return value === "" || options.includes(value);
}

function validateEmail(value) {
  return EMAIL_PATTERN.test(value);
}

function validateImageUrl(value) {
  return LOCAL_IMAGE_PATTERN.test(value) || HTTP_URL_PATTERN.test(value);
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateRegistration(body) {
  const values = {
    displayName: cleanText(body.display_name, 80),
    email: cleanText(body.email, 120).toLowerCase(),
    password: typeof body.password === "string" ? body.password : ""
  };
  const errors = {};

  if (values.displayName.length < 2) {
    errors.displayName = "Display name must be at least 2 characters.";
  }

  if (!validateEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (values.password.length < 10 || values.password.length > 128) {
    errors.password = "Password must be between 10 and 128 characters.";
  }

  return { errors, values };
}

function validateLogin(body) {
  const values = {
    email: cleanText(body.email, 120).toLowerCase(),
    password: typeof body.password === "string" ? body.password : ""
  };
  const errors = {};

  if (!validateEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (values.password.length < 1 || values.password.length > 128) {
    errors.password = "Enter your password.";
  }

  return { errors, values };
}

function validateSearch(query) {
  const values = {
    activityType: cleanText(query.activity_type, 80),
    ageGroup: cleanText(query.age_group, 40),
    category: cleanText(query.category, 40),
    location: cleanText(query.location, 80),
    meetingFrequency: cleanText(query.meeting_frequency, 40),
    name: cleanText(query.name, 80),
    priceType: cleanText(query.price_type, 40),
    venueType: cleanText(query.venue_type, 40)
  };
  const errors = [];

  if (!isAllowedOption(values.category, FILTER_OPTIONS.categories)) {
    errors.push("Invalid category filter.");
  }

  if (!isAllowedOption(values.ageGroup, FILTER_OPTIONS.ageGroups)) {
    errors.push("Invalid age group filter.");
  }

  if (!isAllowedOption(values.priceType, FILTER_OPTIONS.priceTypes)) {
    errors.push("Invalid price filter.");
  }

  if (!isAllowedOption(values.venueType, FILTER_OPTIONS.venueTypes)) {
    errors.push("Invalid venue filter.");
  }

  if (!isAllowedOption(values.meetingFrequency, FILTER_OPTIONS.meetingFrequencies)) {
    errors.push("Invalid meeting frequency filter.");
  }

  return { errors, values };
}

function validateClub(body) {
  const values = {
    activityType: cleanText(body.activity_type, 80),
    address: cleanText(body.address, 160),
    ageGroup: cleanText(body.age_group, 40),
    category: cleanText(body.category, 40),
    contactEmail: cleanText(body.contact_email, 120).toLowerCase(),
    description: cleanText(body.description, 1600, { multiline: true }),
    imageUrl: cleanText(body.image_url, 255) || DEFAULT_CLUB_IMAGE,
    location: cleanText(body.location, 80),
    meetingFrequency: cleanText(body.meeting_frequency, 40),
    meetingTime: cleanText(body.meeting_time, 80),
    name: cleanText(body.name, 100),
    priceType: cleanText(body.price_type, 40),
    venueType: cleanText(body.venue_type, 40)
  };
  const errors = {};

  if (values.name.length < 3) {
    errors.name = "Club name must be at least 3 characters.";
  }

  if (values.activityType.length < 2) {
    errors.activityType = "Activity type is required.";
  }

  if (!FILTER_OPTIONS.categories.includes(values.category)) {
    errors.category = "Choose a valid category.";
  }

  if (!FILTER_OPTIONS.ageGroups.includes(values.ageGroup)) {
    errors.ageGroup = "Choose a valid age group.";
  }

  if (!FILTER_OPTIONS.priceTypes.includes(values.priceType)) {
    errors.priceType = "Choose a valid price type.";
  }

  if (!FILTER_OPTIONS.venueTypes.includes(values.venueType)) {
    errors.venueType = "Choose a valid venue type.";
  }

  if (!FILTER_OPTIONS.meetingFrequencies.includes(values.meetingFrequency)) {
    errors.meetingFrequency = "Choose a valid meeting frequency.";
  }

  if (values.location.length < 2) {
    errors.location = "Location is required.";
  }

  if (values.address.length < 5) {
    errors.address = "Address is required.";
  }

  if (values.meetingTime.length < 3) {
    errors.meetingTime = "Meeting time is required.";
  }

  if (!validateEmail(values.contactEmail)) {
    errors.contactEmail = "Enter a valid contact email.";
  }

  if (values.description.length < 20) {
    errors.description = "Description must be at least 20 characters.";
  }

  if (!validateImageUrl(values.imageUrl)) {
    errors.imageUrl = "Use a local /images/*.svg path or a valid http(s) URL.";
  }

  return { errors, values };
}

function validateReview(body) {
  const values = {
    comment: cleanText(body.comment, 600, { multiline: true }),
    rating: Number.parseInt(String(body.rating), 10)
  };
  const errors = {};

  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) {
    errors.rating = "Rating must be between 1 and 5.";
  }

  if (values.comment.length < 5) {
    errors.comment = "Comment must be at least 5 characters.";
  }

  return { errors, values };
}

function validateContactRequest(body) {
  const values = {
    message: cleanText(body.message, 1000, { multiline: true })
  };
  const errors = {};

  if (values.message.length < 10) {
    errors.message = "Message must be at least 10 characters.";
  }

  return { errors, values };
}

module.exports = {
  cleanText,
  parsePositiveInteger,
  validateClub,
  validateContactRequest,
  validateLogin,
  validateRegistration,
  validateReview,
  validateSearch
};
