import * as ioUtil from '../io-util'
import { itemTableFormatter, jsonFormatter, listTableFormatter, sort, writeOutput, yamlFormatter } from '../output'
import { DefaultTableGenerator, TableGenerator } from '../table-generator'

import { SimpleType } from './test-lib/simple-type'


afterEach(() => {
	jest.resetAllMocks()
})

describe('sort', () => {
	it('handles an empty array', () => {
		const input: SimpleType[] = []
		const result = sort(input, 'str')
		expect(result).toEqual([])
	})

	it('sorts in a case insensitive manner', () => {
		const st = (str: string): SimpleType => ({ str, num: 1 })
		const input: SimpleType[] = [ st('xyz'), st('abc'), st('ABC') ]
		const result = sort(input, 'str')
		expect(result).toEqual([st('abc'), st('ABC'), st('xyz')])
	})
})

describe('simple formatters', () => {
	// These could mock the relatively simple functions they call but it's simpler to it this
	// way and I don't think we gain much from doing that.
	it('jsonFormatter', () => {
		expect(jsonFormatter(2)({ a: 'a_val', b: 2 })).toContain('\n  "a": "a_val')
	})

	it('yamlFormatter', () => {
		expect(yamlFormatter(2)({ a: 'a_val', b: 2 })).toContain('a: a_val')
	})
})

describe('itemTableFormatter', () => {
	it('returns function that calls tableGenerator.buildTableFromItem', () => {
		const buildTableFromItem = jest.fn()
		const mockTableGenerator: TableGenerator = {
			newOutputTable: jest.fn(),
			buildTableFromItem,
			buildTableFromList: jest.fn(),
		}

		const fieldDefinitions = ['str', 'num']
		const formatter = itemTableFormatter(mockTableGenerator, fieldDefinitions)

		const expected = 'expected result'
		buildTableFromItem.mockReturnValue(expected)

		const item: SimpleType = { str: 'string', num: 5 }

		const result = formatter(item)

		expect(result).toBe(expected)
		expect(buildTableFromItem).toHaveBeenCalledTimes(1)
		expect(buildTableFromItem).toHaveBeenCalledWith(item, fieldDefinitions)
	})
})

describe('listTableFormatter', () => {
	const fieldDefinitions = ['str', 'num']
	const expected = 'expected result'

	const list: SimpleType[] = [{ str: 'string1', num: 4 }, { str: 'string2', num: 5 }, { str: 'string3', num: 6 }]

	it('returns function that calls tableGenerator.buildTableFromList', () => {
		const buildTableFromList = jest.fn()
		const mockTableGenerator: TableGenerator = {
			newOutputTable: jest.fn(),
			buildTableFromItem: jest.fn(),
			buildTableFromList,
		}

		const formatter = listTableFormatter(mockTableGenerator, fieldDefinitions)

		buildTableFromList.mockReturnValue(expected)

		const result = formatter(list)

		expect(result).toBe(expected)
		expect(buildTableFromList).toHaveBeenCalledTimes(1)
		expect(buildTableFromList).toHaveBeenCalledWith(list, fieldDefinitions)
	})

	it('handles includeIndex', () => {
		const tableGenerator = new DefaultTableGenerator(true)
		const formatter = listTableFormatter(tableGenerator, fieldDefinitions, /* includeIndex */ true)

		const buildTableSpy = jest.spyOn(tableGenerator, 'buildTableFromList')

		const result = formatter(list)

		expect(buildTableSpy).toHaveBeenCalledTimes(1)
		expect(result).toContain(' # ')
		expect(result).toContain(' 1 ')
		expect(result).toContain(' 2 ')
		expect(result).toContain(' 3 ')

		const result2 = formatter(list)

		// Ensure resets to 1 if we call twice.
		expect(buildTableSpy).toHaveBeenCalledTimes(2)
		expect(result2).toContain(' # ')
		expect(result2).toContain(' 1 ')
		expect(result2).toContain(' 2 ')
		expect(result2).toContain(' 3 ')
	})
})

describe('writeOutput', () => {
	it('writes to file when there is one', async () => {
		const writeFileSpy = jest.spyOn(ioUtil, 'writeFile').mockResolvedValue()

		await writeOutput('data', 'fn')

		expect(writeFileSpy).toHaveBeenCalledTimes(1)
		expect(writeFileSpy).toHaveBeenCalledWith('fn', 'data')
	})

	it('writes to stdout when there is no file', async () => {
		const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true)

		await writeOutput('data\n')

		expect(writeSpy).toHaveBeenCalledTimes(1)
		expect(writeSpy).toHaveBeenCalledWith('data\n')
	})

	it('adds newline to stdout when necessary', async () => {
		const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true)

		await writeOutput('data')

		expect(writeSpy).toHaveBeenCalledTimes(2)
		expect(writeSpy).toHaveBeenCalledWith('data')
		expect(writeSpy).toHaveBeenCalledWith('\n')
	})
})
