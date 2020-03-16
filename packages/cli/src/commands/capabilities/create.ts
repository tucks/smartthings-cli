import fs from 'fs'
import inquirer from 'inquirer'
import yaml from 'js-yaml'
import open from 'open'

import { APICommand } from '@smartthings/cli-lib'
import {
	CapabilityCreate,
	CapabilityAttribute,
	AttributeSchema,
	AttributeProperties,
	JSONSchema,
	CapabilityCommand,
	EnumCommand,
	Argument,
} from '@smartthings/core-sdk'

import { CapabilityDefaultOutput } from '../capabilities'


export default class CapabilitiesCreate extends APICommand {
	static description = 'create a capability for a user'

	static flags = {
		...APICommand.flags,
		...APICommand.inputOutputFlags,
	}

	private createAndDisplay(capability: CapabilityCreate): void {
		this.client.capabilities.create(capability).then(async newCapability => {
			//Create the output content based on flags
			const capabilityDefaultOutput = new CapabilityDefaultOutput()
			let output

			if (this.flags && (this.flags.json || capabilityDefaultOutput.allowedOutputFileType(this.flags.output, true))) {
				output = JSON.stringify(newCapability, null, this.flags.indent || 4)
			} else if (this.flags && (this.flags.yaml || capabilityDefaultOutput.allowedOutputFileType(this.flags.output, false))) {
				output = yaml.safeDump(newCapability, {indent: this.flags.indent || 2 })
			} else {
				output = capabilityDefaultOutput.makeCapabilityTable(newCapability)
			}

			//decide how to output the content based on flags
			if (this.flags && this.flags.output) {
				fs.writeFile(this.flags.output, output, () => {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					open(this.flags!.output!)
				})
			} else {
				this.log(output)
			}
		}).catch(err => {
			this.log(`caught error ${err}`)
		})
	}

	async run(): Promise<void> {
		const { argv, flags } = this.parse(CapabilitiesCreate)
		await super.setup(argv, flags)

		if (flags.input) {
			const capability: CapabilityCreate = yaml.safeLoad(fs.readFileSync(`${flags.input}`, 'utf-8'))
			this.createAndDisplay(capability)
		} else {
			this.capabilityQA()
		}
	}

	validateCapabilityCreate(capability: CapabilityCreate): ValidationResponse {
		if ((!capability.attributes || Object.keys(capability.attributes).length === 0) && (!capability.commands || Object.keys(capability.commands).length === 0)) {
			return {
				status: false,
				reason: 'At least one attribute or capability is required',
			}
		}
		return {
			status: true,
		}
	}

	capabilityQA(): Promise<void> {
		enum actions {
			ATTRIBUTE = 'Add an attribute',
			COMMAND = 'Add a command',
			FINISH = 'Finish & Create'
		}

		enum attributeTypes {
			INTEGER = 'integer',
			NUMBER = 'number',
			STRING = 'string',
			BOOLEAN = 'boolean'
		}

		interface PromptAnswers {
			attributeName?: string
			attributeType?: string
			schemaMinValue?: number
			schemaMaxValue?: number
			schemaMaxLength?: number
			attributeSetter?: boolean
			commandName?: string
			argumentName?: string
			argumentType?: string
			argumentOptional?: boolean
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			basicCommandValue?: any
		}

		//holds answers to each prompt
		const answers: PromptAnswers = {}

		//final capability create object, with required fields
		const capability: CapabilityCreate = { name: '' }

		//holds command arguments while looping before they are added to the capability (0 -> n commands)
		const commandArguments: Argument[] = []

		//holds enum commands while looping before they are added to the capability (0 -> n commands)
		const enumCommands: EnumCommand[] = []

		const prompt = inquirer.createPromptModule()
		const prompts = {
			capabilityName: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'capabilityName',
					message: 'Capability Name: ',
					validate: (input) => {
						return new RegExp('^[a-zA-Z0-9][a-zA-Z0-9 ]{1,35}$').test(input) || 'Invalid capability name'
					},
				}).then(capabilityNameAnswer => {
					capability.name = capabilityNameAnswer.capabilityName
					prompts.capabilityAction()
				})
			},
			capabilityAction: (): Promise<void> => {
				return prompt({
					type: 'list',
					name: 'action',
					message: 'Select an action...',
					choices: [actions.ATTRIBUTE, actions.COMMAND, actions.FINISH],
				}).then(actionAnswer => {
					switch(actionAnswer.action){
						case actions.ATTRIBUTE:
							prompts.attributeName()
							break
						case actions.COMMAND:
							prompts.commandName(false)
							break
						case actions.FINISH:
							const validationResponse: ValidationResponse = this.validateCapabilityCreate(capability)
							//ASK: restart the prompts on validation failure? find out which subItem would error out and start that one over?
							if (validationResponse.status) {
								this.createAndDisplay(capability)
							} else {
								this.log('Validation failed: ',validationResponse.reason)
								prompts.capabilityAction()
							}
							break
					}
				})
			},
			attributeName: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'attributeName',
					message: 'Attribute Name: ',
					validate: (input) => {
						return input.length > 0 || 'Invalid attribute name'
					},
				}).then(attributeNameAnswer => {
					answers.attributeName = attributeNameAnswer.attributeName
					prompts.type(true)
				})
			},
			type: (attribute: boolean): Promise<void> => {
				return prompt({
					type: 'list',
					name: 'type',
					message: `Select an ${attribute ? 'attribute' : 'argument'} type...`,
					choices: [attributeTypes.INTEGER, attributeTypes.NUMBER, attributeTypes.STRING, attributeTypes.BOOLEAN],
				}).then(typeAnswer => {
					answers[attribute ? 'attributeType' : 'argumentType'] = typeAnswer.type
					 if (attribute) {
						switch(typeAnswer.type){
							case attributeTypes.INTEGER:
							case attributeTypes.NUMBER:
								prompts.attributeSchemaMinValue()
								break
							case attributeTypes.STRING:
								prompts.attributeSchemaMaxLength()
								break
							case attributeTypes.BOOLEAN:
								prompts.attributeSetter()
								break
						}
					} else {
						prompts.optionalArgument()
					}
				})
			},
			attributeSchemaMinValue: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'schemaMinValue',
					message: 'Minimum value (default: no minimum): ',
					validate: (input) => {
						//ensures input is either blank (no value) OR a valid number
						return input.length === 0 || !isNaN(input) || 'Please enter a numeric value'
					},
				}).then(schemaMinValueAnswer => {
					if (schemaMinValueAnswer.schemaMinValue) {
						answers.schemaMinValue = parseInt(schemaMinValueAnswer.schemaMinValue)
					}
					prompts.attributeSchemaMaxValue()
				})
			},
			attributeSchemaMaxValue: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'schemaMaxValue',
					message: 'Maximum value (default: no maximum): ',
					validate: (input) => {
						//ensures input is either blank (no value) OR a valid number
						return input.length === 0 || !isNaN(input) || 'Please enter a numeric value'
					},
				}).then(schemaMaxValueAnswer => {
					if (schemaMaxValueAnswer.schemaMaxValue) {
						answers.schemaMaxValue = parseInt(schemaMaxValueAnswer.schemaMaxValue)
					}
					prompts.attributeSetter()
				})
			},
			attributeSchemaMaxLength: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'schemaMaxLength',
					message: 'Maximum length (default: no max length): ',
					validate: (input) => {
						//ensures input is either blank (no value) OR a valid number
						return input.length === 0 || !isNaN(input) || 'Please enter a numeric value'
					},
				}).then(schemaMaxLengthAnswer => {
					if (schemaMaxLengthAnswer.schemaMaxLength) {
						answers.schemaMaxLength = parseInt(schemaMaxLengthAnswer.schemaMaxLength)
					}
					prompts.attributeSetter()
				})
			},
			attributeSetter: (): Promise<void> => {
				return prompt({
					type: 'confirm',
					name: 'addSetter',
					message: 'Add a setter command?',
				}).then(addSetterConfirm => {
					answers.attributeSetter = addSetterConfirm.addSetter
					prompts.basicCommands()
				})
			},
			basicCommands: (): Promise<void> => {
				return prompt({
					type: 'confirm',
					name: 'addBasicCommands',
					message: enumCommands.length === 0 ? 'Include basic commands?' : 'Add another basic command?',
				}).then(addSetterConfirm => {
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					addSetterConfirm.addBasicCommands ? prompts.commandName(true) : createCapabilitySubItem.createAndAddAttribute()
				})
			},
			commandName: (basicCommand: boolean): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'commandName',
					message: 'Command Name: ',
					validate: (input) => {
						return input.length > 0 || 'Invalid command name'
					},
				}).then(commandNameAnswer => {
					answers.commandName = commandNameAnswer.commandName
					basicCommand ? prompts.commandValue() : prompts.commandArgument()
				})
			},
			commandValue: (): Promise<void> => {
				//switch here because prompt type will change based on the attribute type (input parsed to number for ints/nums, input as string for string, list for boolean)
				switch(answers.attributeType){
					//if type is int/num, validation ensures the value follows previous set ranges
					case attributeTypes.INTEGER:
					case attributeTypes.NUMBER:
						return prompt({
							type: 'input',
							name: 'basicCommandValue',
							message: 'Command Value: ',
							validate: (input) => {
								if (isNaN(input)) {
									return 'Please enter a numeric value'
								}
								if (answers.schemaMinValue && parseInt(input) < answers.schemaMinValue) {
									return 'Number below given minimum value'
								}
								if (answers.schemaMaxValue && parseInt(input) > answers.schemaMaxValue) {
									return 'Number above given maximum value'
								}
								return true
							},
						}).then(basicCommandValueAnswer => {
							answers.basicCommandValue = parseInt(basicCommandValueAnswer.basicCommandValue)
							// eslint-disable-next-line @typescript-eslint/no-use-before-define
							createCapabilitySubItem.createAndAddEnumCommand()
						})
					case attributeTypes.STRING:
						return prompt({
							type: 'input',
							name: 'basicCommandValue',
							message: 'Command Value: ',
							validate: (input) => {
								if (answers.schemaMaxLength && input.length > answers.schemaMaxLength) {
									return 'String longer than given maximum length'
								}
								return true
							},
						}).then(basicCommandValueAnswer => {
							answers.basicCommandValue = basicCommandValueAnswer.basicCommandValue
							// eslint-disable-next-line @typescript-eslint/no-use-before-define
							createCapabilitySubItem.createAndAddEnumCommand()
						})
					case attributeTypes.BOOLEAN:
						//if Attribute type is a boolean, give two choices (true/false)
						return prompt({
							type: 'list',
							name: 'basicCommandValue',
							message: 'Command Value: ',
							//choices must be strings as per inquirer documentation
							choices: ['True', 'False'],
						}).then(basicCommandValueAnswer => {
							answers.basicCommandValue = basicCommandValueAnswer.basicCommandValue === 'True'
							// eslint-disable-next-line @typescript-eslint/no-use-before-define
							createCapabilitySubItem.createAndAddEnumCommand()
						})
					default:
						throw Error('This should never be reached')
				}
			},
			commandArgument: (): Promise<void> => {
				return prompt({
					type: 'confirm',
					name: 'addArgument',
					message: commandArguments.length === 0 ? 'Add an argument?' : 'Add another argument?',
				}).then(addArgumentConfirm => {
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					addArgumentConfirm.addArgument ? prompts.argumentName() : createCapabilitySubItem.createAndAddCommand(false, false)
				})
			},
			argumentName: (): Promise<void> => {
				return prompt({
					type: 'input',
					name: 'argumentName',
					message: 'Argument Name: ',
					validate: (input) => {
						return input.length > 0 || 'Argument name is a required field'
					},
				}).then(attributeNameAnswer => {
					answers.argumentName = attributeNameAnswer.argumentName
					prompts.type(false)
				})
			},
			optionalArgument: (): Promise<void> => {
				return prompt({
					type: 'confirm',
					name: 'optionalArgument',
					message: 'Is this argument optional?',
				}).then(optionalCommandConfirm => {
					answers.argumentOptional = optionalCommandConfirm.optionalArgument
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					createCapabilitySubItem.createAndAddCommandArgument(false)
				})
			},
		}

		const createCapabilitySubItem = {
			createAndAddAttribute: (): void => {
				//create attribute with schema
				const attribute = {
					schema: {
						type: 'object',
						properties: {
							value : {
								type: answers.attributeType,
							} as JSONSchema,
						} as AttributeProperties,
						additionalProperties: false,
						required: ['value'],
					} as AttributeSchema,
				} as CapabilityAttribute

				//add ranges to attr schema, if applicable
				if (answers.attributeType === 'integer' || answers.attributeType === 'number') {
					if (answers.schemaMinValue || answers.schemaMinValue === 0) {
						attribute.schema.properties.value.minimum = answers.schemaMinValue
					}
					if (answers.schemaMaxValue || answers.schemaMaxValue === 0 ) {
						attribute.schema.properties.value.maximum = answers.schemaMaxValue
					}
				}
				if (answers.attributeType === 'string' && answers.schemaMaxLength) {
					attribute.schema.properties.value.maxLength = answers.schemaMaxLength
				}

				//add setter command name to attribute and create the command, if applicable
				if (answers.attributeSetter) {
					answers.commandName = `set${answers.attributeName?.replace(/^\w/, c => c.toUpperCase())}`
					attribute.setter = answers.commandName
					answers.argumentName = 'value'
					answers.argumentType = answers.attributeType
					createCapabilitySubItem.createAndAddCommandArgument(true)
				}

				//add enumCommands array to enumCommands, if applicable
				if (enumCommands.length) {
					attribute.enumCommands = Object.assign([] , enumCommands)
					//resets enum commands array to empty
					enumCommands.length = 0
				}

				//add the completed attribute to the capability
				if (answers.attributeName) {
					if (capability.attributes) {
						capability.attributes[answers.attributeName] = attribute
					} else {
						// TODO: I think this is a bug...
						// maybe should be `capability.attributes[answers.attributeName] = attribute`
						capability.attributes = { [answers.attributeName] : attribute }
					}
				} else {
					throw new Error('expected attribute name')
				}

				this.log('Attribute added!')

				//reset answers that may not be overwritten if user adds another attribute
				answers.schemaMaxLength = undefined
				answers.schemaMinValue = undefined
				answers.schemaMaxValue = undefined

				//Prompt from the beginning
				prompts.capabilityAction()
			},
			createAndAddEnumCommand: (): void => {
				enumCommands.push({
					command: answers.commandName,
					value: answers.basicCommandValue,
				} as EnumCommand)
				createCapabilitySubItem.createAndAddCommand(true, false)
			},
			createAndAddCommandArgument: (setterCommandArgument: boolean): void => {
				const arg = {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					name: answers.argumentName!,
					optional: answers.argumentOptional,
					schema: {
						type: answers.argumentType,
					} as JSONSchema,
				} as Argument

				if (setterCommandArgument) {
					//check if the corresponding attribute value has a min/max and include it here as well if it does
					if (answers.schemaMinValue) {
						arg.schema.minimum = answers.schemaMinValue
					}
					if (answers.schemaMaxValue) {
						arg.schema.maximum = answers.schemaMaxValue
					}
					if (answers.schemaMaxLength) {
						arg.schema.maxLength = answers.schemaMaxLength
					}
					commandArguments.push(arg)
					//We can create the command right away because this is for a setter command
					createCapabilitySubItem.createAndAddCommand(false, true)
				} else {
					commandArguments.push(arg)
					this.log('Argument added!')
					prompts.commandArgument()
				}
			},
			createAndAddCommand: (basicCommand: boolean, setterCommand: boolean): void => {
				//add the completed command to the capability
				if (capability.commands) {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					capability.commands[answers.commandName!] = {
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						name: answers.commandName!,
						arguments: Object.assign([] , commandArguments),
					} as CapabilityCommand
				} else {
					capability.commands = {
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						[answers.commandName!] : {
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							name: answers.commandName!,
							arguments: Object.assign([] , commandArguments),
						} as CapabilityCommand,
					}
				}

				//reset the command arguments array to empty
				commandArguments.length = 0

				if (basicCommand) {
					this.log('Command added!')
					//ask for another basic command
					prompts.basicCommands()
				} else if(!setterCommand){
					this.log('Command added!')
					//prompt from the beginning
					prompts.capabilityAction()
				}
				//if this was a setter command, do nothing since the attribute needs to be created
			},
		}

		return new Promise((resolve, reject) => {
			setTimeout(() => prompts.capabilityName().then(resolve, reject), 0) // Set timeout is required, otherwise node hangs
		})
	}
}

interface ValidationResponse {
	status: boolean
	reason?: string
}