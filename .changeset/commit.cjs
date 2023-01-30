function chunkString(str, length) {
	return str.match(new RegExp(".{1," + length + "}", "g")) ?? [];
}

/**
 * @param {import("@changesets/types").Changeset} changeset
 * @returns {string}
 */
function getAddMessage(changeset) {
	const [title, ...rest] = changeset.summary.split("\n");

	const commitBody = chunkString(
		rest[0] === "" ? rest.join("\n") : `\n${rest.join("\n")}`,
		80,
	).join("\n");

	return `Add changeset: ${title}\n${commitBody}`;
}

/**
 *
 * @param {import("@changesets/types").ReleasePlan} releasePlan
 * @returns {string}
 */
function getVersionMessage(releasePlan) {
	const publishableReleases = releasePlan.releases.filter((release) => release.type !== "none");
	const releasesLines = publishableReleases
		.map((release) => `  ${release.name}@${release.newVersion}`)
		.join("\n");

	return `Release changes

Releases:
${chunkString(releasesLines, 80).join("\n")}
`;
}

module.exports = {
	getAddMessage,
	getVersionMessage,
};
