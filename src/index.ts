/* eslint-disable complexity */
const docblock = `/**
* Summary.
*
* Description.
*
* @since x.x.x
*
* @param boolean $isItTrue Check if value is true.
* @param array $args List of arguments in an array format.
* @param string  $var Description of the parameter
* @param {number} $var Description.
* @return Response Add return description here. It can be multiline.
* This is the second line of the description.
*/`;

const TAG_PATTERN = /^\s*\*\s*@\S+/u;

/**
 * Check if a line is empty.
 * A line is considered empty if it contains only whitespace and an asterisk.
 *
 * @param  {string}  line Line to check
 * @return {boolean}      Whether the line is empty
 */
const isEmptyLine = function (line: string): boolean {
	return (/^\s*\/*\*+\/*\s*$/u.test(line));
};

/**
 * Check if a line is a tag line.
 * A line is considered a tag line if it starts with an asterisk and an @.
 *
 * @param  {string}  line Line string to check
 * @return {boolean}      Whether the line is a tag line
 */
const isTagLine = function(line:string): boolean {
	return TAG_PATTERN.test(line);
};

const hasArgument = function(tagName:string){
	return ['@param'].includes(tagName.trim());
};

const hasType = function(tagName:string){
	return ['@param', '@return'].includes(tagName.trim());
};

const consumeUntil = function (line: string, char: string): string {
	let consumed = '';
	for (const currentChar of line) {
		if (currentChar === char) {
			break;
		}

		consumed += currentChar;
	}

	return consumed;
};

const getOffsetFromLineAndColumn = function (
	lines: string[],
	lineIndex: number,
	column: number
): number {
	let offset = 0;
	for (let index = 0; index < lineIndex; index++) {
		offset += lines[index].length;
	}

	// Adding lineIndex for line breaks (assuming LF)
	return offset + column + lineIndex;
};

const parseTagLine = function (line: string) {
	let isTagCollected = false;
	let isTypeCollected = false;
	let isVariableCollected = false;

	const collector = {
		name: '',
		description: '',
		type: '',
		variable: '',
		multiline: false,
		position: {
			start: {
				line: 0,
				column: 0,
				offset: 0,
			},
			end: {
				line: 0,
				column: line.length,
				offset: 0,
			},
		},
	};
	
	for (let index = 0; index < line.length; index++) {
		const char = line[index];

		if (char === '@' && isTagCollected === false) {
			collector.name += char;
			collector.name += consumeUntil(line.slice(index + 1), ' ');
			collector.position.start.column = index;
			index += collector.name.length - 1;

			isTagCollected = true;
			continue;
		}
		
		if (hasType(collector.name)){
			// Javascript type
			if (char === '{' && isTypeCollected === false) {
				collector.type += char;
				collector.type += consumeUntil(line.slice(index + 1), '}');
				collector.type += '}';
				index += collector.type.length;
			
				isTypeCollected = true;
				continue;
			}

			// PHP type
			if (char === ' ' && isTypeCollected === false && isTagCollected === true) {
				collector.type += consumeUntil(line.slice(index + 1), ' ');
				index += collector.type.length;

				isTypeCollected = true;
				continue;
			}
		}

		// PHP variable
		if (char === '$' && isVariableCollected === false && hasArgument(collector.name)) {
			collector.variable += char;
			collector.variable += consumeUntil(line.slice(index + 1), ' ');
			index += collector.variable.length;
			isVariableCollected = true;
			continue;
		}
		
		// Some tags don't have arguments (e.g. @return)
		// If the tag doesn't have an argument, we can assume that the description starts here.
		if (!hasArgument(collector.name) && isTagCollected){
			isVariableCollected = true;
		}

		// Some tags don't have types (e.g. @since)
		// If the tag doesn't have a type, we can assume that the description starts here.
		if (!hasType(collector.name) && isTagCollected){
			isTypeCollected = true;
		}
		
		if (isTagCollected && isTypeCollected && isVariableCollected) {
			collector.description = line.slice(index);
			break;
		}
	}

	return collector;
};

const getMultiLineDesc = function (docblockLines: string[], index: number): string[] {
	const sliceLines = docblockLines.slice(index);
	const description: string[] = [];
	for (const line of sliceLines) {
		// const line = docblockLines[lineIndex];
		if (isEmptyLine(line)) {
			break;
		}

		if (isTagLine(line)) {
			break;
		}
		description.push(line);
	}
	
	return description;
};

const parser = function () {
	const docblockLines = docblock.split(/\r?\n/u);
	let hasMetSummary = false;
	const hasMetDescription = false;
	let hasMetTags = false;

	const collector = {
		summary: '',
		description: '',
		tags: [],
	};

	// eslint-disable-next-line unicorn/no-for-loop
	for (let lineIndex = 0; lineIndex < docblockLines.length; lineIndex++){
		const line = docblockLines[lineIndex];
		if (isEmptyLine(line)) {
			hasMetSummary = true;
			continue;
		}

		const isTagged = isTagLine(line) || hasMetTags;
		if (!isTagged) {
			if (!hasMetSummary) {
				collector.summary += line;
				continue;
			}

			if (!hasMetDescription) {
				collector.description += line;
			}

			continue;
		}

		// Tagged line
		hasMetTags = true;
		const parsedTag = parseTagLine(line);
		
		// if (nextLineType === 'description') {
		// 	parsedTag.description += nextLine;
		// 	lineIndex++;
		// }

		// Add line location
		parsedTag.position.start = {
			line: lineIndex,
			column: parsedTag.position.start.column,
			offset: getOffsetFromLineAndColumn(
				docblockLines, lineIndex, parsedTag.position.start.column
			),
		};

		const multiLineDesc = getMultiLineDesc(docblockLines, lineIndex + 1);
		let lastDescriptionLine = line;
		if (multiLineDesc.length > 0) {
			parsedTag.description += `\n${multiLineDesc.join('\n')}`;
			parsedTag.multiline = true;
			lastDescriptionLine = multiLineDesc.at(-1);
			lineIndex += multiLineDesc.length;
		}
		
		parsedTag.position.end = {
			line: lineIndex,
			column: parsedTag.position.end.column,
			offset: getOffsetFromLineAndColumn(
				docblockLines, lineIndex, lastDescriptionLine.length
			),
		};

		console.log(parsedTag);

		// get tag from line
		collector.tags.push(parsedTag);
	}

	return collector;
};

export { parser };