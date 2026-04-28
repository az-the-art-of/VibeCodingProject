function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanMultilineText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .slice(0, maxLength);
}

function cleanEmail(value) {
  return cleanText(value, 255).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function pickAllowed(value, allowedValues) {
  return allowedValues.includes(value) ? value : "";
}

function validateRegistration(body) {
  const values = {
    name: cleanText(body.name, 80),
    email: cleanEmail(body.email),
    password: String(body.password || "")
  };
  const errors = [];

  if (values.name.length < 2) {
    errors.push("Name must be at least 2 characters long.");
  }
  if (!isValidEmail(values.email)) {
    errors.push("Enter a valid email address.");
  }
  if (values.password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  return { values, errors };
}

function validateLogin(body) {
  const values = {
    email: cleanEmail(body.email),
    password: String(body.password || "")
  };
  const errors = [];

  if (!isValidEmail(values.email)) {
    errors.push("Enter a valid email address.");
  }
  if (!values.password) {
    errors.push("Password is required.");
  }

  return { values, errors };
}

function validateSearchFilters(query) {
  const allowedAgeGroups = ["All Ages", "Adults", "Families", "Seniors", "Teens"];
  const allowedCostTypes = ["Free", "Paid"];
  const allowedVenueTypes = ["Indoor", "Outdoor", "Mixed"];
  const allowedFrequencies = ["Weekly", "Fortnightly", "Monthly"];

  return {
    q: cleanText(query.q, 100),
    activity_type: cleanText(query.activity_type, 60),
    location: cleanText(query.location, 60),
    category: cleanText(query.category, 60),
    age_group: pickAllowed(cleanText(query.age_group, 30), allowedAgeGroups),
    cost_type: pickAllowed(cleanText(query.cost_type, 10), allowedCostTypes),
    venue_type: pickAllowed(cleanText(query.venue_type, 20), allowedVenueTypes),
    meeting_frequency: pickAllowed(cleanText(query.meeting_frequency, 20), allowedFrequencies)
  };
}

function validateReview(body) {
  const values = {
    rating: Number.parseInt(body.rating, 10),
    comment: cleanMultilineText(body.comment, 600)
  };
  const errors = [];

  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) {
    errors.push("Choose a rating from 1 to 5.");
  }
  if (values.comment.length < 10) {
    errors.push("Review comments must be at least 10 characters long.");
  }

  return { values, errors };
}

function validateContactRequest(body) {
  const values = {
    message: cleanMultilineText(body.message, 1000),
    preferred_contact: cleanText(body.preferred_contact, 120)
  };
  const errors = [];

  if (values.message.length < 10) {
    errors.push("Tell the club a little more about your interest.");
  }
  if (values.preferred_contact.length < 5) {
    errors.push("Add a preferred contact method or detail.");
  }

  return { values, errors };
}

function validateClubForm(body) {
  const values = {
    name: cleanText(body.name, 120),
    category: cleanText(body.category, 60),
    activity_type: cleanText(body.activity_type, 60),
    location: cleanText(body.location, 60),
    age_group: cleanText(body.age_group, 30),
    cost_type: cleanText(body.cost_type, 10),
    venue_type: cleanText(body.venue_type, 20),
    meeting_frequency: cleanText(body.meeting_frequency, 20),
    address: cleanText(body.address, 160),
    meeting_time: cleanText(body.meeting_time, 80),
    contact_email: cleanEmail(body.contact_email),
    image_url: cleanText(body.image_url, 500),
    description: cleanMultilineText(body.description, 1200)
  };
  const errors = [];

  if (values.name.length < 3) {
    errors.push("Club name must be at least 3 characters long.");
  }
  if (!values.category) {
    errors.push("Category is required.");
  }
  if (!values.activity_type) {
    errors.push("Activity type is required.");
  }
  if (!values.location) {
    errors.push("Location is required.");
  }
  if (!["All Ages", "Adults", "Families", "Seniors", "Teens"].includes(values.age_group)) {
    errors.push("Choose a valid age group.");
  }
  if (!["Free", "Paid"].includes(values.cost_type)) {
    errors.push("Choose whether the club is free or paid.");
  }
  if (!["Indoor", "Outdoor", "Mixed"].includes(values.venue_type)) {
    errors.push("Choose a valid venue type.");
  }
  if (!["Weekly", "Fortnightly", "Monthly"].includes(values.meeting_frequency)) {
    errors.push("Choose a valid meeting frequency.");
  }
  if (values.address.length < 5) {
    errors.push("Address is required.");
  }
  if (values.meeting_time.length < 3) {
    errors.push("Meeting time is required.");
  }
  if (!isValidEmail(values.contact_email)) {
    errors.push("Enter a valid club contact email.");
  }
  if (!/^https?:\/\//i.test(values.image_url)) {
    errors.push("Image URL must start with http:// or https://.");
  }
  if (values.description.length < 20) {
    errors.push("Description must be at least 20 characters long.");
  }

  return { values, errors };
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateSearchFilters,
  validateReview,
  validateContactRequest,
  validateClubForm
};
