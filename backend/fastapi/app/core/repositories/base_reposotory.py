from abc import ABC, abstractmethod
from typing import TypeVar, Sequence, Generic

_T = TypeVar('_T')

class BaseRepository(ABC, Generic[_T]):
    """
        Abstract generic repo
    
    """

    @abstractmethod
    def create(self, entity)