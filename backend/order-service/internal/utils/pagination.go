package utils

import (
	"strconv"
	"time"
)

func BuildPaginationQuery(baseQuery string, after *time.Time, first *int32, orderBy string, startIndex int) (string, []any) {
	if first == nil {
		defaultFirst := int32(10)
		first = &defaultFirst
	}

	params := []any{}
	query := baseQuery

	paramIdx := startIndex

	if after != nil {
		query += " AND " + orderBy + " > $" + strconv.Itoa(paramIdx)
		params = append(params, *after)
		paramIdx++
	}

	query += " ORDER BY " + orderBy + " ASC, id ASC LIMIT $" + strconv.Itoa(paramIdx)
	params = append(params, *first)

	return query, params
}
