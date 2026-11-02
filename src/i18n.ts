import { moment } from "obsidian";

type Locale = "pt" | "en";

/** Follows the Obsidian interface language (moment.locale() is already kept in sync with it). */
function currentLocale(): Locale {
	return moment.locale().startsWith("pt") ? "pt" : "en";
}

const DICTIONARY = {
	pt: {
		"command.generateNow": "Gerar ocorrências agora",
		"notice.occurrencesGenerated": "Week Grid Planner: {n} ocorrência(s) gerada(s).",
		"notice.noNewOccurrences": "Week Grid Planner: nenhuma ocorrência nova (tudo já estava em dia).",
		"notice.generationDisabled": "Week Grid Planner: geração automática desligada (horizonte = 0).",
		"notice.invalidRrule": 'Week Grid Planner: a regra de recorrência de "{title}" é inválida — essa nota mestre foi pulada.',
		"notice.riskyRule":
			'Week Grid Planner: a regra de "{title}" não define um dia específico (sem BYDAY/BYMONTHDAY/BYMONTH) e não tem campo "date" — a data pode sair errada. Adicione "date: YYYY-MM-DD" na nota mestre.',
		"notice.createFailed": 'Week Grid Planner: falha ao criar "{path}" — veja o console para detalhes.',
		"menu.moveUp": "Mover para cima",
		"menu.moveDown": "Mover para baixo",
		"menu.moveToDay": "Mover para dia…",
		"menu.delete": "Apagar",
		"menu.deletePermanently": "Apagar de verdade",
		"menu.someday": "Someday",
		"card.bodyIcon": "Esta nota tem texto além do frontmatter",
		"card.newTaskPlaceholder": "Nova tarefa…",
		"button.today": "Hoje",
		"confirm.deleteTitle": "Apagar de verdade?",
		"confirm.deleteMessage":
			'"{title}" será removida permanentemente (respeitando sua configuração de lixeira do Obsidian). Isso não pode ser desfeito pelo Week Grid Planner.',
		"confirm.cancel": "Cancelar",
		"confirm.delete": "Apagar",
		"settings.generationSection": "Geração",
		"settings.horizon.name": "Horizonte de geração",
		"settings.horizon.desc":
			'Quantos dias (contando hoje) as ocorrências recorrentes são geradas automaticamente ao abrir o vault. 1 = só hoje, 2 = hoje e amanhã, e assim por diante. Coloque 0 pra desligar a geração automática por completo (nem as de hoje são criadas).',
		"settings.mastersFolder.name": "Pasta de notas mestre",
		"settings.mastersFolder.desc":
			"Pasta onde ficam as notas mestre (a receita da recorrência: master_id + rrule). Nunca aparecem como tarefas.",
		"settings.tasksFolder.name": "Pasta de tarefas",
		"settings.tasksFolder.desc": "Pasta onde ficam as ocorrências reais (não as notas mestre).",
		"settings.safetySection": "Segurança",
		"settings.confirmDelete.name": "Confirmar antes de apagar de verdade",
		"settings.confirmDelete.desc":
			"Pede confirmação antes de remover uma nota permanentemente pelo menu ⋮ → Apagar de verdade.",
		"settings.activityLogSection": "Log de atividade",
		"settings.activityLogEnabled.name": "Manter log de atividade",
		"settings.activityLogEnabled.desc":
			"Registra o que o plugin faz — ocorrências geradas (quais notas), tarefas apagadas (manual ou automaticamente) e erros — numa nota, já que um Notice pode passar despercebido e o console exige o DevTools aberto.",
		"settings.activityLogPath.name": "Caminho da nota de log",
		"settings.activityLogPath.desc": "Caminho no vault. Só importa enquanto o log estiver ativado acima.",
		"settings.validate.empty": "Este campo não pode ficar vazio.",
		"settings.validate.integerMin": "Digite um número inteiro maior ou igual a {min}.",
		"settings.appearanceSection": "Aparência",
		"settings.cardColorStyle.name": "Estilo de cor do card",
		"settings.cardColorStyle.desc": "Como a cor de uma tarefa aparece no card.",
		"settings.cardColorStyle.sideBorder": "Borda lateral",
		"settings.cardColorStyle.fill": "Preenchimento",
		"settings.cardColorStyle.tweek": "Estilo Tweek (pílula no texto)",
		"settings.sideBorderThickness.name": "Grossura da borda lateral",
		"settings.sideBorderThickness.desc": 'Em pixels. Só se aplica ao modo "Borda lateral" — "Borda ao redor do card" mantém 2px fixo.',
		"settings.colorPalette.name": "Paleta de cores",
		"settings.colorPalette.desc":
			'{n} cor(es) definida(s). Permite usar um nome (ex: "trabalho") em vez de um código hex na propriedade color de uma nota — o nome é resolvido pela paleta. Um código hex direto (ex: "#3b82f6") continua funcionando normalmente.',
		"settings.colorPalette.button": "Gerenciar paleta de cores…",
		"command.deleteOldTasks": "Apagar tarefas antigas…",
		"command.bringOverdueToToday": "Trazer tarefas atrasadas para hoje",
		"command.bringOverdueToSomeday": "Trazer tarefas atrasadas para Someday",
		"cleanup.modalTitle": "Apagar tarefas antigas",
		"cleanup.desc":
			"Remove definitivamente as tarefas cujo campo \"date\" é mais antigo que o intervalo escolhido. Só olha para arquivos dentro da pasta de tarefas configurada — nada mais no vault é afetado.",
		"cleanup.interval.name": "Mais antigas que",
		"cleanup.interval.1m": "1 mês",
		"cleanup.interval.3m": "3 meses",
		"cleanup.interval.6m": "6 meses",
		"cleanup.interval.1y": "1 ano",
		"cleanup.interval.2y": "2 anos",
		"cleanup.continue": "Continuar",
		"cleanup.noneFound": "Week Grid Planner: nenhuma tarefa mais antiga que o intervalo escolhido.",
		"cleanup.confirmTitle": "Apagar tarefas antigas?",
		"cleanup.confirmMessage":
			"{n} tarefa(s) com date anterior a {interval} atrás serão apagadas de verdade (respeitando sua configuração de lixeira do Obsidian). Isso não pode ser desfeito pelo Week Grid Planner.",
		"cleanup.deleted": "Week Grid Planner: {n} tarefa(s) antiga(s) apagada(s).",
		"notice.overdueToToday": "Week Grid Planner: {n} tarefa(s) atrasada(s) movida(s) para hoje.",
		"notice.overdueToSomeday": "Week Grid Planner: {n} tarefa(s) atrasada(s) movida(s) para Someday.",
		"notice.noOverdueFound": "Week Grid Planner: nenhuma tarefa atrasada encontrada.",
		"notice.autoCleanup": "Week Grid Planner: {n} tarefa(s) antiga(s) apagada(s) automaticamente.",
		"settings.autoCleanup.name": "Apagar tarefas antigas automaticamente",
		"settings.autoCleanup.desc":
			"Roda junto com a geração das ocorrências do horizonte (toda vez que o Obsidian abre). Baseado no campo \"date\", só dentro da pasta de tarefas configurada.",
		"settings.autoCleanup.never": "Nunca (desligado)",
		"settings.cancelledTaskStyle.name": "Estilo de tarefa cancelada",
		"settings.cancelledTaskStyle.desc": "Como tarefas com status \"cancelled\" (não vou fazer) aparecem no card.",
		"settings.cancelledTaskStyle.strikethrough": "Riscado (igual concluída)",
		"settings.cancelledTaskStyle.red": "Texto vermelho",
		"settings.cancelledTaskStyle.both": "Ambos (riscado + vermelho)",
		"settings.cardTextOverflow.name": "Texto longo no card",
		"settings.cardTextOverflow.desc": "Como exibir um título de tarefa longo demais pra caber em uma linha.",
		"settings.cardTextOverflow.truncate": "Cortar com \"…\"",
		"settings.cardTextOverflow.wrap": "Pular linha",
		"menu.markCancelled": "Marcar como cancelada",
		"menu.unmarkCancelled": "Desmarcar cancelada",
		"command.checkMasterConflicts": "Verificar master_id duplicados…",
		"conflicts.modalTitle": "master_id duplicados",
		"conflicts.desc":
			"Estes valores de master_id são usados por mais de uma nota mestre. A geração de ocorrências pode pular vagas de uma nota mestre silenciosamente porque a outra já preencheu o mesmo slot.",
		"notice.noMasterConflicts": "Week Grid Planner: nenhum master_id duplicado encontrado.",
		"notice.masterConflictsWarning":
			"Week Grid Planner: {n} master_id duplicado(s) encontrado(s) — rode \"Verificar master_id duplicados…\" pra ver os detalhes.",
		"notice.firstRunSetup":
			"Week Grid Planner: primeira execução — abra Ajustes → Week Grid Planner e escolha (ou crie) as pastas de notas mestre e de tarefas. Pasta(s) ainda não encontrada(s): {folders}.",
		"notice.foldersMissing":
			"Week Grid Planner: pasta(s) não encontrada(s): {folders} — confira Ajustes → Week Grid Planner.",
		"notice.taskFolderMissingOnCreate":
			"Week Grid Planner: a pasta de tarefas \"{folder}\" não existe — crie-a ou ajuste-a em Ajustes → Week Grid Planner antes de adicionar tarefas.",
		"command.addTagsToExisting": "Adicionar tags às notas existentes…",
		"command.generateTemplates": "Gerar templates de notas…",
		"notice.tagNotConfigured": "Week Grid Planner: nenhuma tag configurada em Ajustes → Week Grid Planner.",
		"tagBackfill.noneFound": "Week Grid Planner: todas as notas já têm a tag configurada.",
		"tagBackfill.confirmTitle": "Adicionar tags às notas existentes?",
		"tagBackfill.confirmMessage":
			"{n} nota(s) nas pastas de notas mestre e de tarefas vão receber a tag configurada. Tags já existentes nessas notas não são alteradas.",
		"tagBackfill.confirmButton": "Adicionar tags",
		"tagBackfill.done": "Week Grid Planner: tag adicionada em {n} nota(s).",
		"tagRename.modalTitle": "Aplicar tag",
		"tagRename.off": "— (desligada)",
		"tagRename.desc":
			"Isto reescreve a lista de tags em toda nota dentro das pastas de notas mestre e de tarefas (só essas duas pastas), removendo a tag antiga e adicionando a nova. Outras tags na nota não são alteradas.",
		"tagRename.mastersLabel": "Notas mestre",
		"tagRename.tasksLabel": "Ocorrências",
		"tagRename.noChanges": "Nenhuma mudança pendente — a tag já está igual à ativa no momento.",
		"tagRename.apply": "Aplicar tag",
		"tagRename.done": "Week Grid Planner: tag atualizada em {n} nota(s).",
		"fieldRename.modalTitle": "Renomear propriedades",
		"fieldRename.desc":
			"Isto reescreve as chaves de frontmatter abaixo em toda nota dentro das pastas de notas mestre e de tarefas (só essas duas pastas). Nada mais no vault é afetado.",
		"fieldRename.noChanges":
			"Nenhuma mudança pendente — os nomes de propriedade já estão iguais aos ativos no momento.",
		"fieldRename.counting": "Contando notas afetadas…",
		"fieldRename.confirmMessage": "{n} nota(s) serão atualizadas.",
		"fieldRename.apply": "Aplicar renomeação",
		"fieldRename.done": "Week Grid Planner: propriedades renomeadas em {n} nota(s).",
		"settings.tagSection": "Tag",
		"settings.tagSection.desc":
			'Mudar os campos abaixo não altera nada sozinho — clique em "Aplicar tag agora" para migrar as notas existentes (remove a tag antiga, adiciona a nova) e ativar a mudança. Use o comando "Adicionar tags às notas existentes…" separadamente pra só preencher tags faltando na configuração atual, sem migrar nada.',
		"settings.noteTag.name": "Tag das notas",
		"settings.noteTag.desc":
			'Tag (sem #) usada nas notas. Ocorrências novas recebem a tag automaticamente; notas mestre não (você as escreve à mão). Deixe em branco para desligar.',
		"settings.useTagSuffixes.name": "Usar sufixos /tasks e /masters",
		"settings.useTagSuffixes.desc":
			'Ligado: "{tag}/masters" nas notas mestre e "{tag}/tasks" nas ocorrências. Desligado: a tag "{tag}" pura nos dois casos.',
		"settings.applyTag.desc":
			"Migra as notas existentes nas pastas de notas mestre e de tarefas da tag ativa pra tag acima (remove a antiga, adiciona a nova), e passa a usá-la a partir de agora.",
		"settings.applyTag.button": "Aplicar tag agora",
		"settings.propertyNamesSection": "Nomes de propriedade",
		"settings.propertyNames.desc":
			'Qual chave de frontmatter cada campo usa. Mudar os campos abaixo não altera nada sozinho — clique em "Aplicar renomeação agora" para reescrever as notas existentes e ativar os novos nomes.',
		"settings.fieldPrefix.name": "Prefixo de propriedade",
		"settings.fieldPrefix.desc":
			'Usado só pelo botão abaixo, pra preencher os campos de uma vez (ex: "status" → "wgp_status").',
		"settings.applyPrefixToAll": "Aplicar prefixo a todos os campos abaixo",
		"settings.field.masterId": "Campo master_id",
		"settings.field.rrule": "Campo rrule",
		"settings.field.title": "Campo title",
		"settings.field.color": "Campo color",
		"settings.field.date": "Campo date",
		"settings.field.originalDate": "Campo original_date",
		"settings.field.status": "Campo status",
		"settings.field.order": "Campo order",
		"settings.applyRename.desc":
			"Reescreve as notas existentes nas pastas de notas mestre e de tarefas para usar os nomes acima, e passa a usá-los a partir de agora.",
		"settings.applyRename.button": "Aplicar renomeação agora",
		"templateGen.modalTitle": "Gerar templates de notas",
		"templateGen.desc":
			"Cria um template de nota mestre e um de tarefa com o frontmatter (e a tag, se configurada) que o plugin usa atualmente. Não sobrescreve arquivos existentes.",
		"templateGen.folder.name": "Pasta de destino",
		"templateGen.folder.placeholder": "Templates",
		"templateGen.generate": "Gerar",
		"templateGen.noFolder": "Week Grid Planner: escolha uma pasta de destino.",
		"templateGen.folderMissing": 'Week Grid Planner: a pasta "{folder}" não existe.',
		"templateGen.masterFileName": "WGP Template de nota mestre",
		"templateGen.taskFileName": "WGP Template de tarefa",
		"templateGen.done": "Week Grid Planner: templates gerados.",
		"templateGen.doneWithSkips":
			"Week Grid Planner: templates gerados ({skipped} já existia(m) e foram mantidos).",
		"colorPalette.modalTitle": "Paleta de cores",
		"colorPalette.desc":
			'Cada entrada mapeia um nome pra um código hex. Numa nota, use color: nome em vez de color: "#hex" — nomes não encontrados na paleta ficam sem cor, sem erro.',
		"colorPalette.addName": "Nova cor",
		"colorPalette.namePlaceholder": "ex: trabalho",
		"colorPalette.add": "Adicionar",
		"colorPalette.remove": "Remover",
	},
	en: {
		"command.generateNow": "Generate occurrences now",
		"notice.occurrencesGenerated": "Week Grid Planner: {n} occurrence(s) generated.",
		"notice.noNewOccurrences": "Week Grid Planner: no new occurrences (everything up to date).",
		"notice.generationDisabled": "Week Grid Planner: automatic generation is off (horizon = 0).",
		"notice.invalidRrule": 'Week Grid Planner: the recurrence rule for "{title}" is invalid — this master note was skipped.',
		"notice.riskyRule":
			'Week Grid Planner: the rule for "{title}" doesn\'t define a specific day (no BYDAY/BYMONTHDAY/BYMONTH) and has no "date" field — the date may end up wrong. Add "date: YYYY-MM-DD" to the master note.',
		"notice.createFailed": 'Week Grid Planner: failed to create "{path}" — check the console for details.',
		"menu.moveUp": "Move up",
		"menu.moveDown": "Move down",
		"menu.moveToDay": "Move to day…",
		"menu.delete": "Delete",
		"menu.deletePermanently": "Delete permanently",
		"menu.someday": "Someday",
		"card.bodyIcon": "This note has text beyond the frontmatter",
		"card.newTaskPlaceholder": "New task…",
		"button.today": "Today",
		"confirm.deleteTitle": "Delete permanently?",
		"confirm.deleteMessage":
			'"{title}" will be permanently removed (respecting your Obsidian trash setting). This cannot be undone from within Week Grid Planner.',
		"confirm.cancel": "Cancel",
		"confirm.delete": "Delete",
		"settings.generationSection": "Generation",
		"settings.horizon.name": "Generation horizon",
		"settings.horizon.desc":
			"How many days (counting today) recurring occurrences are automatically generated when the vault opens. 1 = today only, 2 = today and tomorrow, and so on. Set to 0 to disable automatic generation entirely (not even today's).",
		"settings.mastersFolder.name": "Masters folder",
		"settings.mastersFolder.desc":
			"Folder holding the master notes (the recurrence recipe: master_id + rrule). Never shown as tasks.",
		"settings.tasksFolder.name": "Tasks folder",
		"settings.tasksFolder.desc": "Folder holding the actual occurrences (not the master notes).",
		"settings.safetySection": "Safety",
		"settings.confirmDelete.name": "Confirm before deleting permanently",
		"settings.confirmDelete.desc":
			"Asks for confirmation before permanently removing a note via the ⋮ menu → Delete permanently.",
		"settings.activityLogSection": "Activity log",
		"settings.activityLogEnabled.name": "Keep an activity log",
		"settings.activityLogEnabled.desc":
			"Records what the plugin does — occurrences generated (which notes), tasks deleted (manually or automatically), and errors — in a note, since a Notice can be missed and the console needs DevTools open.",
		"settings.activityLogPath.name": "Log note path",
		"settings.activityLogPath.desc": "Vault path. Only matters while logging is enabled above.",
		"settings.validate.empty": "This field can't be empty.",
		"settings.validate.integerMin": "Enter a whole number, {min} or greater.",
		"settings.appearanceSection": "Appearance",
		"settings.cardColorStyle.name": "Card color style",
		"settings.cardColorStyle.desc": "How a task's color shows up on the card.",
		"settings.cardColorStyle.sideBorder": "Side border",
		"settings.cardColorStyle.fill": "Fill",
		"settings.cardColorStyle.tweek": "Tweek style (pill on text)",
		"settings.sideBorderThickness.name": "Side border thickness",
		"settings.sideBorderThickness.desc":
			'In pixels. Only applies to "Side border" mode — "Border around the card" stays a fixed 2px.',
		"settings.colorPalette.name": "Color palette",
		"settings.colorPalette.desc":
			'{n} color(s) defined. Lets you use a name (e.g. "work") instead of a hex code in a note\'s color property — the name is resolved through the palette. A raw hex code (e.g. "#3b82f6") still works as before.',
		"settings.colorPalette.button": "Manage color palette…",
		"command.deleteOldTasks": "Delete old tasks…",
		"command.bringOverdueToToday": "Bring overdue tasks to today",
		"command.bringOverdueToSomeday": "Bring overdue tasks to Someday",
		"cleanup.modalTitle": "Delete old tasks",
		"cleanup.desc":
			'Permanently removes tasks whose "date" field is older than the chosen interval. Only looks at files inside the configured tasks folder — nothing else in the vault is touched.',
		"cleanup.interval.name": "Older than",
		"cleanup.interval.1m": "1 month",
		"cleanup.interval.3m": "3 months",
		"cleanup.interval.6m": "6 months",
		"cleanup.interval.1y": "1 year",
		"cleanup.interval.2y": "2 years",
		"cleanup.continue": "Continue",
		"cleanup.noneFound": "Week Grid Planner: no task older than the chosen interval.",
		"cleanup.confirmTitle": "Delete old tasks?",
		"cleanup.confirmMessage":
			"{n} task(s) with a date older than {interval} ago will be permanently deleted (respecting your Obsidian trash setting). This cannot be undone from within Week Grid Planner.",
		"cleanup.deleted": "Week Grid Planner: {n} old task(s) deleted.",
		"notice.overdueToToday": "Week Grid Planner: {n} overdue task(s) moved to today.",
		"notice.overdueToSomeday": "Week Grid Planner: {n} overdue task(s) moved to Someday.",
		"notice.noOverdueFound": "Week Grid Planner: no overdue task found.",
		"notice.autoCleanup": "Week Grid Planner: {n} old task(s) automatically deleted.",
		"settings.autoCleanup.name": "Automatically delete old tasks",
		"settings.autoCleanup.desc":
			'Runs alongside horizon occurrence generation (every time Obsidian opens). Based on the "date" field, only inside the configured tasks folder.',
		"settings.autoCleanup.never": "Never (off)",
		"settings.cancelledTaskStyle.name": "Cancelled task style",
		"settings.cancelledTaskStyle.desc": 'How tasks with status "cancelled" (won\'t do) look on the card.',
		"settings.cancelledTaskStyle.strikethrough": "Strikethrough (like done)",
		"settings.cancelledTaskStyle.red": "Red text",
		"settings.cancelledTaskStyle.both": "Both (strikethrough + red)",
		"settings.cardTextOverflow.name": "Long card text",
		"settings.cardTextOverflow.desc": "How to display a task title too long to fit on one line.",
		"settings.cardTextOverflow.truncate": 'Truncate with "…"',
		"settings.cardTextOverflow.wrap": "Wrap to new line",
		"menu.markCancelled": "Mark as cancelled",
		"menu.unmarkCancelled": "Unmark cancelled",
		"command.checkMasterConflicts": "Check for duplicate master IDs…",
		"conflicts.modalTitle": "Duplicate master IDs",
		"conflicts.desc":
			"These master_id values are used by more than one master note. Occurrence generation may silently skip slots for one master note because the other already filled them.",
		"notice.noMasterConflicts": "Week Grid Planner: no duplicate master IDs found.",
		"notice.masterConflictsWarning":
			'Week Grid Planner: {n} duplicate master ID(s) found — run "Check for duplicate master IDs…" for details.',
		"notice.firstRunSetup":
			'Week Grid Planner: first run — open Settings → Week Grid Planner and choose (or create) the masters and tasks folders. Folder(s) not found yet: {folders}.',
		"notice.foldersMissing":
			"Week Grid Planner: folder(s) not found: {folders} — check Settings → Week Grid Planner.",
		"notice.taskFolderMissingOnCreate":
			'Week Grid Planner: the tasks folder "{folder}" doesn\'t exist — create it or update it in Settings → Week Grid Planner before adding tasks.',
		"command.addTagsToExisting": "Add tags to existing notes…",
		"command.generateTemplates": "Generate note templates…",
		"notice.tagNotConfigured": "Week Grid Planner: no tag configured in Settings → Week Grid Planner.",
		"tagBackfill.noneFound": "Week Grid Planner: every note already has the configured tag.",
		"tagBackfill.confirmTitle": "Add tags to existing notes?",
		"tagBackfill.confirmMessage":
			"{n} note(s) in the masters and tasks folders will get the configured tag. Tags already on those notes are left alone.",
		"tagBackfill.confirmButton": "Add tags",
		"tagBackfill.done": "Week Grid Planner: tag added to {n} note(s).",
		"tagRename.modalTitle": "Apply tag",
		"tagRename.off": "— (off)",
		"tagRename.desc":
			"This rewrites the tags list in every note inside the masters and tasks folders (only those two folders), removing the old tag and adding the new one. Other tags on the note are left alone.",
		"tagRename.mastersLabel": "Master notes",
		"tagRename.tasksLabel": "Occurrences",
		"tagRename.noChanges": "No pending change — the tag already matches what's currently active.",
		"tagRename.apply": "Apply tag",
		"tagRename.done": "Week Grid Planner: tag updated in {n} note(s).",
		"fieldRename.modalTitle": "Rename properties",
		"fieldRename.desc":
			"This rewrites the frontmatter keys below in every note inside the masters and tasks folders (only those two folders). Nothing else in the vault is affected.",
		"fieldRename.noChanges": "No pending change — the property names already match what's currently active.",
		"fieldRename.counting": "Counting affected notes…",
		"fieldRename.confirmMessage": "{n} note(s) will be updated.",
		"fieldRename.apply": "Apply rename",
		"fieldRename.done": "Week Grid Planner: properties renamed in {n} note(s).",
		"settings.tagSection": "Tag",
		"settings.tagSection.desc":
			'Editing the fields below doesn\'t change anything by itself — click "Apply tag now" to migrate existing notes (removes the old tag, adds the new one) and switch to it. Use the "Add tags to existing notes…" command separately to just fill in tags missing under the current config, without migrating anything.',
		"settings.noteTag.name": "Note tag",
		"settings.noteTag.desc":
			"Tag (without #) used on notes. New occurrences get it automatically; master notes don't (you write those by hand). Leave blank to turn it off.",
		"settings.useTagSuffixes.name": "Use /tasks and /masters suffixes",
		"settings.useTagSuffixes.desc":
			'On: "{tag}/masters" on master notes and "{tag}/tasks" on occurrences. Off: the plain "{tag}" tag on both.',
		"settings.applyTag.desc":
			"Migrates existing notes in the masters and tasks folders from the active tag to the one above (removes the old, adds the new), and starts using it from now on.",
		"settings.applyTag.button": "Apply tag now",
		"settings.propertyNamesSection": "Property names",
		"settings.propertyNames.desc":
			'Which frontmatter key each field uses. Editing the fields below doesn\'t change anything by itself — click "Apply rename now" to rewrite existing notes and switch to the new names.',
		"settings.fieldPrefix.name": "Property prefix",
		"settings.fieldPrefix.desc":
			'Only used by the button below, to bulk-fill the fields at once (e.g. "status" → "wgp_status").',
		"settings.applyPrefixToAll": "Apply prefix to all fields below",
		"settings.field.masterId": "master_id field",
		"settings.field.rrule": "rrule field",
		"settings.field.title": "title field",
		"settings.field.color": "color field",
		"settings.field.date": "date field",
		"settings.field.originalDate": "original_date field",
		"settings.field.status": "status field",
		"settings.field.order": "order field",
		"settings.applyRename.desc":
			"Rewrites existing notes in the masters and tasks folders to use the names above, and starts using them from now on.",
		"settings.applyRename.button": "Apply rename now",
		"templateGen.modalTitle": "Generate note templates",
		"templateGen.desc":
			"Creates a master-note template and a task template with the frontmatter (and tag, if configured) the plugin currently uses. Won't overwrite existing files.",
		"templateGen.folder.name": "Destination folder",
		"templateGen.folder.placeholder": "Templates",
		"templateGen.generate": "Generate",
		"templateGen.noFolder": "Week Grid Planner: choose a destination folder.",
		"templateGen.folderMissing": 'Week Grid Planner: the folder "{folder}" doesn\'t exist.',
		"templateGen.masterFileName": "WGP Master note template",
		"templateGen.taskFileName": "WGP Task template",
		"templateGen.done": "Week Grid Planner: templates generated.",
		"templateGen.doneWithSkips": "Week Grid Planner: templates generated ({skipped} already existed and were left alone).",
		"colorPalette.modalTitle": "Color palette",
		"colorPalette.desc":
			'Each entry maps a name to a hex code. In a note, use color: name instead of color: "#hex" — names not found in the palette get no color, no error.',
		"colorPalette.addName": "New color",
		"colorPalette.namePlaceholder": "e.g. work",
		"colorPalette.add": "Add",
		"colorPalette.remove": "Remove",
	},
} as const;

type Key = keyof (typeof DICTIONARY)["pt"];
export type { Key };

/** Translates `key` to the Obsidian interface language, replacing {placeholders} with the values in vars. */
export function t(key: Key, vars?: Record<string, string | number>): string {
	const text = DICTIONARY[currentLocale()][key] ?? DICTIONARY.en[key];
	if (!vars) return text;
	return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), text as string);
}
