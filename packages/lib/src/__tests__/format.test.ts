import { formatAndWriteItem, formatAndWriteList } from '../format'
import { IOFormat } from '../io-util'
import * as output from '../output'
import * as outputBuilder from '../output-builder'
import { buildMockCommand } from './test-lib/mock-command'
import { SimpleType } from './test-lib/simple-type'


describe('format', () => {
	const item = { str: 'string', num: 5 }
	const list = [item]
	const baseCommand = {
		...buildMockCommand(),
		flags: {
			output: 'output.yaml',
		},
	}

	const outputFormatter: jest.Mock<string, [data: unknown]> = jest.fn().mockReturnValue('output')
	const buildOutputFormatterSpy = jest.spyOn(outputBuilder, 'buildOutputFormatter').mockReturnValue(outputFormatter)
	const writeOutputSpy = jest.spyOn(output, 'writeOutput').mockResolvedValue()

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('formatAndWriteItem', () => {
		const itemTableFormatterSpy = jest.spyOn(output, 'itemTableFormatter')

		it('uses tableFieldDefinitions when specified', async () => {
			const command = {
				...baseCommand,
				tableFieldDefinitions: [],
			}

			const commonFormatter = jest.fn()
			itemTableFormatterSpy.mockReturnValue(commonFormatter)

			await formatAndWriteItem(command, item, IOFormat.COMMON)

			expect(itemTableFormatterSpy).toHaveBeenCalledTimes(1)
			expect(itemTableFormatterSpy).toHaveBeenCalledWith(command.tableGenerator, command.tableFieldDefinitions)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, IOFormat.COMMON, commonFormatter)
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith(item)
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')
		})

		it('uses buildTableOutput when specified', async () => {
			const command = {
				...baseCommand,
				buildTableOutput: jest.fn(),
			}

			await formatAndWriteItem<SimpleType>(command, item, IOFormat.JSON)

			expect(itemTableFormatterSpy).toHaveBeenCalledTimes(0)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, IOFormat.JSON, expect.anything())
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith(item)
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')

			// Call the OutputFormatter that was build to ensure it uses `buildTableOutput`
			const commonFormatter: output.OutputFormatter<SimpleType> = buildOutputFormatterSpy.mock.calls[0][2] as never
			command.buildTableOutput.mockReturnValue('common output')
			expect(commonFormatter(item)).toBe('common output')
			expect(command.buildTableOutput).toHaveBeenCalledTimes(1)
		})
	})

	describe('formatAndWriteList', () => {
		const listTableFormatterSpy= jest.spyOn(output, 'listTableFormatter')

		it('returns no items found when none found', async () => {
			const command = {
				...baseCommand,
				buildListTableOutput: jest.fn(),
			}

			await formatAndWriteList<SimpleType>(command, [], true)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(0)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, expect.anything())
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith([])
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')

			// Call the OutputFormatter that was build to ensure it uses `buildTableOutput`
			const commonFormatter: output.OutputFormatter<SimpleType[]> = buildOutputFormatterSpy.mock.calls[0][2] as never
			expect(commonFormatter(list)).toBe('no items found')
		})

		it('returns no items found when none found; name specified', async () => {
			const command = {
				...baseCommand,
				buildListTableOutput: jest.fn(),
				itemName: 'thing',
			}

			await formatAndWriteList<SimpleType>(command, [], true)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(0)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, expect.anything())
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith([])
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')

			// Call the OutputFormatter that was build to ensure it uses `buildTableOutput`
			const commonFormatter: output.OutputFormatter<SimpleType[]> = buildOutputFormatterSpy.mock.calls[0][2] as never
			expect(commonFormatter(list)).toBe('no things found')
		})

		it('returns no items found when none found; plural name specified', async () => {
			const command = {
				...baseCommand,
				buildListTableOutput: jest.fn(),
				pluralItemName: 'candies',
			}

			await formatAndWriteList<SimpleType>(command, [], true)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(0)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, expect.anything())
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith([])
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')

			// Call the OutputFormatter that was build to ensure it uses `buildTableOutput`
			const commonFormatter: output.OutputFormatter<SimpleType[]> = buildOutputFormatterSpy.mock.calls[0][2] as never
			expect(commonFormatter(list)).toBe('no candies found')
		})

		it('uses listTableFieldDefinitions when specified', async () => {
			const command = {
				...baseCommand,
				listTableFieldDefinitions: [],
			}

			const commonFormatter = jest.fn()
			listTableFormatterSpy.mockReturnValue(commonFormatter)

			await formatAndWriteList(command, list)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(1)
			expect(listTableFormatterSpy).toHaveBeenCalledWith(command.tableGenerator, command.listTableFieldDefinitions, false)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, commonFormatter)
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith(list)
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')
		})

		it('uses buildListTableOutput when specified', async () => {
			const command = {
				...baseCommand,
				buildListTableOutput: jest.fn(),
			}

			await formatAndWriteList<SimpleType>(command, list, true)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(0)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, expect.anything())
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith(list)
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')

			// Call the OutputFormatter that was build to ensure it uses `buildTableOutput`
			const commonFormatter: output.OutputFormatter<SimpleType[]> = buildOutputFormatterSpy.mock.calls[0][2] as never
			command.buildListTableOutput.mockReturnValue('common output')
			expect(commonFormatter(list)).toBe('common output')
			expect(command.buildListTableOutput).toHaveBeenCalledTimes(1)
		})

		it('uses Sorting fields as a fallback', async () => {
			const command = {
				...baseCommand,
				primaryKeyName: 'num',
				sortKeyName: 'str',
			}

			const commonFormatter = jest.fn()
			listTableFormatterSpy.mockReturnValue(commonFormatter)

			await formatAndWriteList(command, list)

			expect(listTableFormatterSpy).toHaveBeenCalledTimes(1)
			expect(listTableFormatterSpy).toHaveBeenCalledWith(command.tableGenerator, ['str', 'num'], false)
			expect(buildOutputFormatterSpy).toHaveBeenCalledTimes(1)
			expect(buildOutputFormatterSpy).toHaveBeenCalledWith(command, undefined, commonFormatter)
			expect(outputFormatter).toHaveBeenCalledTimes(1)
			expect(outputFormatter).toHaveBeenCalledWith(list)
			expect(writeOutputSpy).toHaveBeenCalledTimes(1)
			expect(writeOutputSpy).toHaveBeenCalledWith('output', 'output.yaml')
		})
	})
})
